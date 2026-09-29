import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSearchCategory } from "@/lib/search-options";

const SEARCH_WEBHOOK_URL =
  "https://n8n-f2ty.srv1670697.hstgr.cloud/webhook/find-solutions";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getClientAddress(request: Request): string | null {
  const forwarded =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0];
  const address = forwarded?.trim();
  if (address && isIP(address)) return address;
  return process.env.NODE_ENV !== "production" ? "127.0.0.1" : null;
}

function getPublicSearchLimit() {
  const configured = process.env.PUBLIC_SEARCH_LIMIT_PER_HOUR;
  if (!configured) return 20;
  const limit = Number(configured);
  return Number.isInteger(limit) && limit >= 1 && limit <= 1000 ? limit : null;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid search request." }, { status: 400 });
  }

  const problem = typeof body.problem === "string" ? body.problem.trim() : "";
  const language = body.language === undefined ? "en" : body.language;
  const category = body.category;
  if (problem.length < 1 || problem.length > 2000) {
    return NextResponse.json(
      { error: "Enter a search between 1 and 2,000 characters." },
      { status: 400 }
    );
  }
  if (language !== "en" && language !== "bn") {
    return NextResponse.json({ error: "Choose a supported language." }, { status: 400 });
  }
  if (category !== undefined && !isSearchCategory(category)) {
    return NextResponse.json({ error: "Choose a supported category." }, { status: 400 });
  }

  const clientAddress = getClientAddress(request);
  const rateLimit = getPublicSearchLimit();
  const rateLimitSecret = process.env.PUBLIC_SEARCH_RATE_LIMIT_SECRET;
  if (!clientAddress || !rateLimit || !rateLimitSecret) {
    console.error("Public search protection is not configured.");
    return NextResponse.json(
      { error: "Public search is temporarily unavailable. Please try again later." },
      { status: 503 }
    );
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
    const fingerprint = createHmac("sha256", rateLimitSecret)
      .update(clientAddress)
      .digest("hex");
    const { data, error } = await admin.rpc("reserve_public_search", {
      p_fingerprint: fingerprint,
      p_limit: rateLimit,
    });
    if (error) {
      console.error("Public search rate limit check failed:", {
        code: error.code,
        message: error.message,
      });
      return NextResponse.json(
        { error: "Public search protection is not ready. Please try again later." },
        { status: 503 }
      );
    }
    const reservation = Array.isArray(data) ? data[0] : data;
    if (
      !isRecord(reservation) ||
      typeof reservation.allowed !== "boolean" ||
      typeof reservation.remaining !== "number" ||
      typeof reservation.reset_at !== "string"
    ) {
      console.error("Public search rate limit check returned an invalid response.");
      return NextResponse.json(
        { error: "Public search protection is not ready. Please try again later." },
        { status: 503 }
      );
    }
    if (!reservation.allowed) {
      return NextResponse.json(
        {
          error: "You have reached the public search limit. Please try again after the hourly reset.",
          resetAt: reservation.reset_at,
        },
        { status: 429 }
      );
    }
  } catch (error) {
    console.error(
      "Unable to initialize public search protection:",
      error instanceof Error ? error.message : "Unknown configuration error."
    );
    return NextResponse.json(
      { error: "Public search protection is not ready. Please try again later." },
      { status: 503 }
    );
  }

  try {
    const webhookResponse = await fetch(SEARCH_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        problem,
        language,
        ...(category ? { category } : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });
    const responseBody = await webhookResponse.text();
    if (webhookResponse.ok) {
      const { error } = await admin.rpc("record_public_product_search");
      if (error) {
        console.error("Public search analytics could not be recorded:", {
          code: error.code,
          message: error.message,
        });
      }
    }
    const hasNoBody = [204, 205, 304].includes(webhookResponse.status);
    return new Response(hasNoBody ? null : responseBody, {
      status: webhookResponse.status,
      headers: {
        "Content-Type":
          webhookResponse.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(
      "SolutionFinder public search proxy failed:",
      error instanceof Error ? error.message : "Unknown network error."
    );
    return NextResponse.json(
      { error: "The solution service is temporarily unavailable." },
      { status: 502 }
    );
  }
}

import { NextResponse } from "next/server";
import { normalizeUrl } from "@/lib/solutions";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getWebhookUrl() {
  const value = process.env.N8N_FEEDBACK_WEBHOOK_URL;
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    return NextResponse.json(
      { error: "Feedback collection is not configured yet." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (
    !isRecord(body) ||
    typeof body.helpful !== "boolean" ||
    !isRecord(body.solution) ||
    typeof body.solution.name !== "string" ||
    body.solution.name.trim().length < 1 ||
    body.solution.name.length > 300
  ) {
    return NextResponse.json({ error: "Invalid feedback request." }, { status: 400 });
  }

  const url = normalizeUrl(body.solution.url);
  if (!url) {
    return NextResponse.json({ error: "A valid solution link is required." }, { status: 400 });
  }

  const searchId =
    typeof body.searchId === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      body.searchId
    )
      ? body.searchId
      : null;
  if (body.searchId !== undefined && body.searchId !== null && searchId === null) {
    return NextResponse.json({ error: "Invalid search reference." }, { status: 400 });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchId,
        solution: { name: body.solution.name.trim(), url },
        helpful: body.helpful,
        submittedAt: new Date().toISOString(),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error("Feedback webhook returned HTTP", response.status);
      return NextResponse.json(
        { error: "Feedback could not be delivered right now." },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(
      "SolutionFinder feedback webhook failed:",
      error instanceof Error ? error.message : "Unknown network error."
    );
    return NextResponse.json(
      { error: "Feedback could not be delivered right now." },
      { status: 502 }
    );
  }
}

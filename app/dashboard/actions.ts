"use server";

import { redirect } from "next/navigation";
import type { Solution } from "@/lib/solutions";
import { getSolutions, normalizeUrl } from "@/lib/solutions";
import { createClient } from "@/lib/supabase/server";
import { createTestStripeClient, getSiteUrl } from "@/lib/stripe/server";
import { isWorkspaceMigrationMissing } from "@/lib/supabase/workspace-errors";
import { logSupabaseError } from "@/lib/supabase/diagnostics";
import type { SearchLanguage } from "@/lib/search-language";
import { isSearchCategory, type SearchCategory } from "@/lib/search-options";

type Usage = {
  plan_name: string;
  used_count: number;
  search_limit: number | null;
  remaining: number | null;
  configured: boolean;
};

type Reservation = {
  search_id: string | null;
  plan_name: string;
  used_count: number;
  search_limit: number | null;
  allowed: boolean;
  reason: string | null;
};

export type DashboardSearchResult =
  | {
      ok: true;
      searchId: string;
      problem: string;
      solutions: Solution[];
      resultProblem: string | null;
      usage: Usage;
    }
  | { ok: false; reason: "limit" | "configuration" | "error"; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function firstRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    return isRecord(value[0]) ? value[0] : null;
  }
  return isRecord(value) ? value : null;
}

function readReservation(value: unknown): Reservation | null {
  const record = firstRecord(value);
  if (!record) return null;
  if (
    typeof record.plan_name !== "string" ||
    typeof record.used_count !== "number" ||
    typeof record.allowed !== "boolean"
  ) {
    return null;
  }
  return {
    search_id: typeof record.search_id === "string" ? record.search_id : null,
    plan_name: record.plan_name,
    used_count: record.used_count,
    search_limit:
      typeof record.search_limit === "number" ? record.search_limit : null,
    allowed: record.allowed,
    reason: typeof record.reason === "string" ? record.reason : null,
  };
}

async function getSignedInUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("Your session has expired. Sign in again to continue.");
  }
  return { supabase, user: data.user };
}

export async function runDashboardSearch(
  rawProblem: string,
  language: SearchLanguage = "en",
  category?: SearchCategory
): Promise<DashboardSearchResult> {
  if (typeof rawProblem !== "string") {
    return { ok: false, reason: "error", message: "Enter a problem to search for." };
  }
  if (language !== "en" && language !== "bn") {
    return {
      ok: false,
      reason: "error",
      message: "Choose a supported search language.",
    };
  }
  if (category !== undefined && !isSearchCategory(category)) {
    return {
      ok: false,
      reason: "error",
      message: "Choose a supported search category.",
    };
  }
  const problem = rawProblem.trim();
  if (problem.length < 2 || problem.length > 2000) {
    return {
      ok: false,
      reason: "error",
      message: "Enter a search between 2 and 2,000 characters.",
    };
  }

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    ({ supabase } = await getSignedInUser());
  } catch (error) {
    return {
      ok: false,
      reason: "error",
      message: error instanceof Error ? error.message : "Please sign in to search.",
    };
  }

  const { data: reservationData, error: reservationError } = await supabase.rpc(
    "reserve_search",
    { p_problem: problem }
  );
  if (reservationError) {
    if (isWorkspaceMigrationMissing(reservationError)) {
      return {
        ok: false,
        reason: "error",
        message:
          "Search history is not ready. Apply supabase/migrations/202609290001_saas_workspace.sql in Supabase, then retry.",
      };
    }
    const reference = logSupabaseError("reserve_search", reservationError);
    const isPlanConfigurationError =
      reservationError.message.includes("PLAN_LIMIT_NOT_CONFIGURED");
    return {
      ok: false,
      reason: isPlanConfigurationError ? "configuration" : "error",
      message: isPlanConfigurationError
        ? "Search limits are not configured yet. Ask the administrator to finish plan setup."
        : `Search could not be reserved because of a Supabase database error (${reservationError.code ?? "unknown"}). Reference: ${reference}. Check the server log for the diagnostic.`,
    };
  }

  const reservation = readReservation(reservationData);
  if (!reservation) {
    console.error("The SolutionFinder usage reservation returned an invalid response.");
    return {
      ok: false,
      reason: "error",
      message: "Unable to confirm your usage allowance. Please try again.",
    };
  }
  if (!reservation.allowed) {
    if (reservation.reason === "SEARCH_LIMIT_REACHED") {
      return {
        ok: false,
        reason: "limit",
        message: "You’ve reached this plan’s monthly search limit. Your allowance resets at the start of next month (UTC).",
      };
    }
    return {
      ok: false,
      reason: "configuration",
      message: "The search allowance for this plan has not been configured yet.",
    };
  }
  if (!reservation.search_id) {
    console.error("The allowed SolutionFinder search did not include a history ID.");
    return {
      ok: false,
      reason: "error",
      message: "Unable to save this search. Please try again.",
    };
  }

  let responseData: unknown;
  try {
    const response = await fetch(
      "https://n8n-f2ty.srv1670697.hstgr.cloud/webhook/find-solutions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problem,
          language,
          ...(category ? { category } : {}),
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(45_000),
      }
    );
    if (!response.ok) {
      throw new Error(`The solution service returned HTTP ${response.status}.`);
    }
    responseData = await response.json();
  } catch (error) {
    const { error: historyError } = await supabase.rpc("fail_search", {
      p_search_id: reservation.search_id,
      p_error_message: "The solution service did not return a usable response.",
    });
    if (historyError && !isWorkspaceMigrationMissing(historyError)) {
      logSupabaseError("fail_search", historyError);
    }
    console.error(
      "The SolutionFinder search service failed:",
      error instanceof Error ? error.message : "Unknown network error."
    );
    return {
      ok: false,
      reason: "error",
      message: "We couldn’t reach the solution service. Your attempt is recorded; please try again.",
    };
  }

  const { data: completed, error: updateError } = await supabase.rpc(
    "complete_search",
    {
      p_search_id: reservation.search_id,
      p_response_data: responseData,
    }
  );
  if (updateError || completed !== true) {
    if (updateError) {
      if (!isWorkspaceMigrationMissing(updateError)) {
        const reference = logSupabaseError("complete_search", updateError);
        return {
          ok: false,
          reason: "error",
          message: `The solution service responded, but Supabase could not save the search (${updateError.code ?? "unknown"}). Reference: ${reference}. Check the server log for the diagnostic.`,
        };
      }
      return {
        ok: false,
        reason: "error",
        message:
          "The solution service responded, but the search-history database function is missing. Apply supabase/migrations/202609290001_saas_workspace.sql in Supabase.",
      };
    }
    return {
      ok: false,
      reason: "error",
      message: "Solutions were returned, but we couldn’t save your search history. Please try again.",
    };
  }

  const { data: usageData, error: usageError } = await supabase.rpc("get_plan_usage");
  if (usageError && !isWorkspaceMigrationMissing(usageError)) {
    logSupabaseError("get_plan_usage", usageError);
  }
  const usageRecord = firstRecord(usageData);
  const usage: Usage = usageRecord
    ? {
        plan_name:
          typeof usageRecord.plan_name === "string"
            ? usageRecord.plan_name
            : reservation.plan_name,
        used_count:
          typeof usageRecord.used_count === "number"
            ? usageRecord.used_count
            : reservation.used_count,
        search_limit:
          typeof usageRecord.search_limit === "number"
            ? usageRecord.search_limit
            : reservation.search_limit,
        remaining:
          typeof usageRecord.remaining === "number" ? usageRecord.remaining : null,
        configured: usageRecord.configured === true,
      }
    : {
        plan_name: reservation.plan_name,
        used_count: reservation.used_count,
        search_limit: reservation.search_limit,
        remaining: null,
        configured: false,
      };

  return {
    ok: true,
    searchId: reservation.search_id,
    problem,
    solutions: getSolutions(responseData),
    resultProblem:
      isRecord(responseData) &&
      isRecord(responseData.result) &&
      typeof responseData.result.problem === "string"
        ? responseData.result.problem
        : null,
    usage,
  };
}

export async function saveSolution(
  searchId: string,
  solution: Solution
): Promise<{ ok: boolean; message?: string }> {
  if (
    typeof searchId !== "string" ||
    searchId.length > 64 ||
    !solution ||
    typeof solution.name !== "string" ||
    solution.name.length > 300 ||
    typeof solution.description !== "string" ||
    solution.description.length > 5000 ||
    typeof solution.url !== "string" ||
    solution.url.length > 2048
  ) {
    return { ok: false, message: "That solution could not be saved." };
  }

  let supabase: Awaited<ReturnType<typeof createClient>>;
  let userId: string;
  try {
    const signedIn = await getSignedInUser();
    supabase = signedIn.supabase;
    userId = signedIn.user.id;
  } catch {
    return { ok: false, message: "Your session has expired. Sign in again." };
  }

  const { data: search, error: searchError } = await supabase
    .from("search_history")
    .select("problem,response_data,status")
    .eq("id", searchId)
    .eq("status", "completed")
    .maybeSingle();
  if (searchError || !search) {
    if (searchError && !isWorkspaceMigrationMissing(searchError)) {
      const reference = logSupabaseError("load_search_for_saved_solution", searchError);
      return {
        ok: false,
        message: `Supabase could not load the source search (${searchError.code ?? "unknown"}). Reference: ${reference}. Check the server log for the diagnostic.`,
      };
    }
    if (searchError) {
      return {
        ok: false,
        message:
          "Search history is not ready. Apply supabase/migrations/202609290001_saas_workspace.sql in Supabase.",
      };
    }
    return { ok: false, message: "This search is no longer available to save." };
  }

  const validSolution = getSolutions(search.response_data).some(
    (item) =>
      item.name === solution.name &&
      item.description === solution.description &&
      item.url === normalizeUrl(solution.url)
  );
  if (!validSolution) {
    return { ok: false, message: "That solution does not belong to this search." };
  }

  const { error } = await supabase.from("saved_solutions").upsert(
    {
      user_id: userId,
      source_search_id: searchId,
      problem: search.problem,
      solution_name: solution.name,
      description: solution.description,
      solution_url: solution.url,
    },
    {
      onConflict: "user_id,source_search_id,solution_name,solution_url",
      ignoreDuplicates: true,
    }
  );
  if (error) {
    if (isWorkspaceMigrationMissing(error)) {
      return {
        ok: false,
        message:
          "Saved solutions are not ready. Apply supabase/migrations/202609290001_saas_workspace.sql in Supabase.",
      };
    }
    const reference = logSupabaseError("save_solution", error);
    return {
      ok: false,
      message: `Supabase could not save this solution (${error.code ?? "unknown"}). Reference: ${reference}. Check the server log for the diagnostic.`,
    };
  }
  return { ok: true };
}

export async function removeSavedSolution(
  savedId: string
): Promise<{ ok: boolean; message?: string }> {
  if (typeof savedId !== "string" || savedId.length > 64) {
    return { ok: false, message: "That saved solution could not be removed." };
  }
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    ({ supabase } = await getSignedInUser());
  } catch {
    return { ok: false, message: "Your session has expired. Sign in again." };
  }

  const { error } = await supabase.from("saved_solutions").delete().eq("id", savedId);
  if (error) {
    if (isWorkspaceMigrationMissing(error)) {
      return {
        ok: false,
        message:
          "Saved solutions are not ready. Apply supabase/migrations/202609290001_saas_workspace.sql in Supabase.",
      };
    }
    const reference = logSupabaseError("remove_saved_solution", error);
    return {
      ok: false,
      message: `Supabase could not remove this solution (${error.code ?? "unknown"}). Reference: ${reference}. Check the server log for the diagnostic.`,
    };
  }
  return { ok: true };
}

function usageError(message: string): never {
  redirect(`/dashboard/usage?error=${encodeURIComponent(message)}`);
}

export async function startPremiumCheckout() {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let user: Awaited<ReturnType<typeof getSignedInUser>>["user"];
  try {
    ({ supabase, user } = await getSignedInUser());
  } catch {
    usageError("Your session has expired. Sign in again to upgrade.");
  }
  const priceId = process.env.STRIPE_PREMIUM_PRICE_ID;
  if (!priceId || !priceId.startsWith("price_")) {
    usageError(
      "Premium checkout is not configured. Add the Stripe test-mode STRIPE_PREMIUM_PRICE_ID."
    );
  }
  let stripe: ReturnType<typeof createTestStripeClient>;
  try {
    stripe = createTestStripeClient();
  } catch (error) {
    usageError(
      error instanceof Error
        ? error.message
        : "Stripe test mode is not configured."
    );
  }

  const { data: currentSubscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id,status,current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();
  if (subscriptionError) {
    console.error("Unable to check the current subscription:", subscriptionError.message);
    usageError("Subscription data is unavailable. Apply the workspace migration.");
  }
  if (
    currentSubscription &&
    ["active", "trialing"].includes(currentSubscription.status) &&
    currentSubscription.current_period_end &&
    new Date(currentSubscription.current_period_end) > new Date()
  ) {
    redirect("/dashboard/usage?message=Your%20Premium%20subscription%20is%20already%20active.");
  }

  const { data: premiumPlan, error: planError } = await supabase
    .from("plan_catalog")
    .select("price_display,currency,search_limit")
    .eq("id", "premium")
    .maybeSingle();
  if (planError || !premiumPlan) {
    if (planError && !isWorkspaceMigrationMissing(planError)) {
      console.error("Unable to verify Premium checkout configuration:", planError.message);
    }
    usageError("Premium plan configuration is unavailable.");
  }
  if (
    premiumPlan.search_limit === null ||
    premiumPlan.search_limit < 0 ||
    premiumPlan.price_display.startsWith("CONFIGURE_") ||
    premiumPlan.currency.startsWith("CONFIGURE_")
  ) {
    usageError("Configure the Premium price and search allowance before enabling checkout.");
  }

  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      customer: currentSubscription?.stripe_customer_id ?? undefined,
      customer_email: currentSubscription?.stripe_customer_id ? undefined : user.email,
      metadata: { user_id: user.id },
      subscription_data: { metadata: { user_id: user.id } },
      success_url: `${getSiteUrl()}/dashboard/usage?checkout=success`,
      cancel_url: `${getSiteUrl()}/dashboard/usage?checkout=cancelled`,
    }, {
      idempotencyKey: `solutionfinder-premium:${user.id}:${Math.floor(Date.now() / 600_000)}`,
    });
  } catch (error) {
    console.error(
      "Unable to create a Stripe test checkout session:",
      error instanceof Error ? error.message : "Unknown Stripe error."
    );
    usageError("Stripe could not start checkout. Check your test Price ID and account settings.");
  }

  if (!session.url) {
    usageError("Stripe did not return a Checkout URL. Please try again.");
  }
  redirect(session.url);
}

export async function openSubscriptionPortal() {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let user: Awaited<ReturnType<typeof getSignedInUser>>["user"];
  try {
    ({ supabase, user } = await getSignedInUser());
  } catch {
    usageError("Your session has expired. Sign in again to manage your plan.");
  }
  let stripe: ReturnType<typeof createTestStripeClient>;
  try {
    stripe = createTestStripeClient();
  } catch (error) {
    usageError(
      error instanceof Error
        ? error.message
        : "Stripe test mode is not configured."
    );
  }
  const { data: subscription, error } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Unable to load the Stripe customer:", error.message);
    usageError("Subscription data is unavailable. Apply the workspace migration.");
  }
  if (!subscription?.stripe_customer_id) {
    usageError("No Stripe customer is linked to this account yet.");
  }

  let portal: Awaited<ReturnType<typeof stripe.billingPortal.sessions.create>>;
  try {
    portal = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${getSiteUrl()}/dashboard/usage`,
    });
  } catch (error) {
    console.error(
      "Unable to create the Stripe customer portal session:",
      error instanceof Error ? error.message : "Unknown Stripe error."
    );
    usageError("Stripe could not open subscription management. Please try again.");
  }
  redirect(portal.url);
}

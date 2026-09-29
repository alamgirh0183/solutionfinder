import { redirect } from "next/navigation";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { isWorkspaceMigrationMissing } from "@/lib/supabase/workspace-errors";

export type DashboardUsage = {
  plan_name: string;
  used_count: number;
  search_limit: number | null;
  remaining: number | null;
  configured: boolean;
  period_end: string | null;
};

export async function requireDashboardUser() {
  if (!hasSupabaseConfig()) {
    redirect("/login?error=Supabase%20is%20not%20configured.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error("Unable to authenticate a dashboard request:", error.message);
    redirect("/login?error=Unable%20to%20verify%20your%20session.%20Please%20sign%20in.");
  }
  if (!data.user) {
    redirect("/login?next=%2Fdashboard");
  }
  return { supabase, user: data.user };
}

function firstRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === "object" && !Array.isArray(first)
      ? (first as Record<string, unknown>)
      : null;
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export async function loadPlanUsage(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase.rpc("get_plan_usage");
  if (error) {
    if (!isWorkspaceMigrationMissing(error)) {
      console.error("Unable to load the current plan usage:", error.message);
    }
    return {
      usage: null,
      error:
        "Usage data is unavailable. Apply the SolutionFinder workspace migration to enable plans and search limits.",
    };
  }

  const row = firstRecord(data);
  if (
    !row ||
    typeof row.plan_name !== "string" ||
    typeof row.used_count !== "number"
  ) {
    console.error("The plan usage function returned an invalid response.");
    return { usage: null, error: "Your plan usage could not be read." };
  }

  return {
    usage: {
      plan_name: row.plan_name,
      used_count: row.used_count,
      search_limit: typeof row.search_limit === "number" ? row.search_limit : null,
      remaining: typeof row.remaining === "number" ? row.remaining : null,
      configured: row.configured === true,
      period_end: typeof row.period_end === "string" ? row.period_end : null,
    } satisfies DashboardUsage,
    error: null,
  };
}

import HomeSearch from "@/components/home-search";
import { planPlaceholders } from "@/lib/plans";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { isWorkspaceMigrationMissing } from "@/lib/supabase/workspace-errors";

export const dynamic = "force-dynamic";

type PlanRow = {
  id: "free" | "premium";
  name: string;
  description: string | null;
  price_display: string;
  currency: string;
  interval: string | null;
  search_limit: number;
  features: unknown;
};

function isConfiguredPlan(
  value: unknown,
  expectedId: "free" | "premium"
): value is PlanRow {
  if (typeof value !== "object" || value === null) return false;

  const row = value as Record<string, unknown>;

  return (
    row.id === expectedId &&
    typeof row.name === "string" &&
    row.name.trim().length > 0 &&
    (typeof row.description === "string" || row.description === null) &&
    typeof row.price_display === "string" &&
    row.price_display.trim().length > 0 &&
    typeof row.currency === "string" &&
    row.currency.trim().length > 0 &&
    (typeof row.interval === "string" || row.interval === null) &&
    typeof row.search_limit === "number" &&
    Number.isInteger(row.search_limit) &&
    row.search_limit > 0
  );
}

function getFeatures(features: unknown): string[] {
  return Array.isArray(features)
    ? features.filter(
        (feature): feature is string => typeof feature === "string"
      )
    : [];
}

export default async function Home() {
  let isAuthenticated = false;
  let plans = planPlaceholders;
  let plansConfigured = false;

  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();

    if (error && error.name !== "AuthSessionMissingError") {
      console.error(
        "Unable to verify the current Supabase user:",
        error.message
      );
    } else {
      isAuthenticated = Boolean(data.user);
    }

    const { data: planData, error: planError } = await supabase
      .from("plan_catalog")
      .select(
        "id,name,description,price_display,currency,interval,search_limit,features"
      )
      .order("id");

    if (planError && !isWorkspaceMigrationMissing(planError)) {
      console.error(
        "Unable to load public plan configuration:",
        planError.message
      );
    } else if (!planError && Array.isArray(planData)) {
      const rows: unknown[] = planData;
      const freePlan = rows.find((row) => isConfiguredPlan(row, "free"));
      const premiumPlan = rows.find((row) =>
        isConfiguredPlan(row, "premium")
      );

      if (rows.length === 2 && freePlan && premiumPlan) {
        plans = [
          {
            ...freePlan,
            id: "free" as const,
            description: freePlan.description ?? "",
            interval: freePlan.interval ?? "month",
            features: getFeatures(freePlan.features),
          },
          {
            ...premiumPlan,
            id: "premium" as const,
            description: premiumPlan.description ?? "",
            interval: premiumPlan.interval ?? "month",
            features: getFeatures(premiumPlan.features),
          },
        ];

        plansConfigured = true;
      }
    }
  }

  return (
    <HomeSearch
      isAuthenticated={isAuthenticated}
      plans={plans}
      plansConfigured={plansConfigured}
    />
  );
}
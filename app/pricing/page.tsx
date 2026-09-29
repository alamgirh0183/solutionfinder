import Link from "next/link";
import { planPlaceholders, type Plan } from "@/lib/plans";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import PricingSection from "@/components/pricing-section";
import { isWorkspaceMigrationMissing } from "@/lib/supabase/workspace-errors";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Compare SolutionFinder Free and Premium plans, monthly search allowances, and included features.",
  openGraph: {
    title: "SolutionFinder pricing",
    description:
      "Compare SolutionFinder Free and Premium plans, monthly search allowances, and included features.",
  },
};

export default async function PricingPage() {
  let plans: Plan[] = planPlaceholders;
  let plansConfigured = false;
  if (hasSupabaseConfig()) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("plan_catalog")
      .select("id,name,description,price_display,currency,interval,search_limit,features")
      .order("id");
    if (error && !isWorkspaceMigrationMissing(error)) {
      console.error("Unable to load public plan configuration:", error.message);
    } else if (data && data.length === 2) {
      plans = data.map((plan) => ({
        ...plan,
        id: plan.id === "premium" ? "premium" : "free",
        features: Array.isArray(plan.features) ? plan.features : [],
      }));
      plansConfigured = true;
    }
  }

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-sm font-bold text-white">
            S
          </span>
          <span className="text-xl font-bold tracking-tight">SolutionFinder</span>
        </Link>
        <div className="flex items-center gap-2 text-sm">
          <Link href="/" className="rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-100">
            Home
          </Link>
          <Link href="/pricing" className="rounded-lg bg-blue-50 px-3 py-2 font-medium text-blue-700">
            Pricing
          </Link>
          <Link href="/login" className="rounded-lg px-3 py-2 text-gray-600 hover:bg-gray-100">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-gray-900 px-4 py-2 font-medium text-white hover:bg-gray-700"
          >
            Get started
          </Link>
        </div>
      </nav>
      <h1 className="sr-only">SolutionFinder pricing plans</h1>
      <PricingSection plans={plans} configured={plansConfigured} />
    </main>
  );
}

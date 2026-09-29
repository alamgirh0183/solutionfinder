"use client";

import Link from "next/link";
import {
  getPlanFeatureLabel,
  getPlanLimitLabel,
  getPlanPriceLabel,
  isPlanConfigured,
  planPlaceholders,
  type Plan,
} from "@/lib/plans";

export default function PricingSection({
  plans = planPlaceholders,
  configured = false,
}: {
  plans?: Plan[];
  configured?: boolean;
}) {
  const valuesConfigured =
    configured &&
    plans.length === 2 &&
    plans.every(isPlanConfigured);

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
          Simple plans
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
          Find the right plan for your research
        </h2>
        <p className="mt-4 text-base leading-7 text-gray-600">
          Start with free solution discovery. Upgrade when you need more.
        </p>
      </div>
      {!valuesConfigured && (
        <p className="mx-auto mb-6 max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-center text-sm text-amber-900">
          Monthly search allowances are shown below. Pricing and billing details remain
          placeholders until the database and Stripe test settings are configured.
        </p>
      )}
      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
        {plans.map((plan) => (
          <article
            key={plan.id}
            className={`rounded-3xl border p-7 shadow-sm ${
              plan.id === "premium"
                ? "border-blue-300 bg-gradient-to-b from-blue-50/60 to-white shadow-blue-100"
                : "border-gray-200 bg-white"
            }`}
          >
            <p className="text-sm font-semibold text-blue-700">{plan.name}</p>
            <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="min-w-0 break-words text-3xl font-bold tracking-tight sm:text-4xl">
                {getPlanPriceLabel(plan)}
              </span>
              {plan.price_display !== "Free" && (
                <span className="shrink-0 text-sm text-gray-500">
                  / {plan.interval}
                  {plan.currency &&
                    !plan.currency.startsWith("CONFIGURE_") &&
                    ` · ${plan.currency}`}
                </span>
              )}
            </div>
            <p className="mt-3 min-h-12 break-words text-sm leading-6 text-gray-600">
              {plan.description}
            </p>
            <p className="mt-5 break-words rounded-xl bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-800">
              {getPlanLimitLabel(plan.search_limit, plan.id)}
            </p>
            <ul className="mt-6 space-y-3">
              {plan.features
                .filter(
                  (feature) =>
                    !(
                      (plan.search_limit === null || plan.search_limit < 0) &&
                      (feature === "CONFIGURE_FREE_MONTHLY_SEARCH_LIMIT" ||
                        feature === "CONFIGURE_PREMIUM_MONTHLY_SEARCH_LIMIT")
                    )
                )
                .map((feature) => (
                <li key={feature} className="flex min-w-0 gap-3 text-sm text-gray-700">
                  <span className="font-bold text-blue-600">✓</span>
                  <span className="min-w-0 break-words">{getPlanFeatureLabel(feature)}</span>
                </li>
                ))}
            </ul>
            <Link
              href={plan.id === "premium" ? "/login?next=%2Fdashboard%2Fusage" : "/signup"}
              className={`mt-8 flex min-h-12 items-center justify-center rounded-xl px-5 text-sm font-semibold transition ${
                plan.id === "premium"
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-900 text-white hover:bg-gray-700"
              }`}
            >
              {plan.id === "premium" ? "Explore Premium" : "Get started free"}
            </Link>
          </article>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-gray-500">
        Prices and plan allowances are configured by the SolutionFinder team.
        Premium checkout is in Stripe test mode only.
      </p>
    </section>
  );
}

import Link from "next/link";
import {
  openSubscriptionPortal,
  startPremiumCheckout,
} from "@/app/dashboard/actions";
import { loadPlanUsage, requireDashboardUser } from "@/lib/dashboard";
import {
  getPlanLimitLabel,
  getPlanPriceLabel,
  planPlaceholders,
  type Plan,
} from "@/lib/plans";
import { isWorkspaceMigrationMissing } from "@/lib/supabase/workspace-errors";

export const dynamic = "force-dynamic";

export default async function UsagePage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; error?: string; message?: string }>;
}) {
  const { supabase, user } = await requireDashboardUser();
  const [{ usage, error: usageError }, { data: plansData, error: plansError }, { data: subscription, error: subscriptionError }] =
    await Promise.all([
      loadPlanUsage(supabase),
      supabase
        .from("plan_catalog")
        .select("id,name,description,price_display,currency,interval,search_limit,features")
        .order("id"),
      supabase
        .from("subscriptions")
        .select("stripe_customer_id,status,current_period_end,cancel_at_period_end")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
  if (plansError && !isWorkspaceMigrationMissing(plansError)) {
    console.error("Unable to load account plan details:", plansError.message);
  }
  if (subscriptionError && !isWorkspaceMigrationMissing(subscriptionError)) {
    console.error("Unable to load subscription details:", subscriptionError.message);
  }

  const plans: Plan[] =
    plansData?.length === 2
      ? plansData.map((plan) => ({
          ...plan,
          id: plan.id === "premium" ? "premium" : "free",
          features: Array.isArray(plan.features) ? plan.features : [],
        }))
      : planPlaceholders;
  const freePlan = plans.find((plan) => plan.id === "free") ?? planPlaceholders[0];
  const premiumPlan =
    plans.find((plan) => plan.id === "premium") ?? planPlaceholders[1];
  const isPremium = usage?.plan_name === "premium";
  const { checkout, error, message } = await searchParams;
  const stripeReady =
    process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") === true &&
    process.env.STRIPE_PREMIUM_PRICE_ID?.startsWith("price_") === true &&
    premiumPlan.search_limit !== null &&
    premiumPlan.search_limit >= 0 &&
    !premiumPlan.price_display.startsWith("CONFIGURE_") &&
    !premiumPlan.currency.startsWith("CONFIGURE_");

  return (
    <section>
      <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">Your workspace</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Usage & plan</h1>
      <p className="mt-2 text-sm text-gray-600">Your plan allowance and subscription status.</p>

      {checkout === "success" && (
        <p role="status" className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          Checkout completed. Premium activates only after Stripe’s verified webhook confirms your subscription. Refresh this page in a moment.
        </p>
      )}
      {checkout === "cancelled" && (
        <p role="status" className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
          Checkout was cancelled. Your current plan has not changed.
        </p>
      )}
      {message && (
        <p role="status" className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </p>
      )}
      {usageError && (
        <p role="alert" className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {usageError}
        </p>
      )}
      {(plansError || subscriptionError) && (
        <p role="alert" className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Plan details are unavailable. Apply the workspace migration and reload this page.
        </p>
      )}

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Current plan</p>
              <h2 className="mt-1 text-2xl font-bold capitalize">{usage?.plan_name ?? "Free"}</h2>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isPremium ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"
            }`}>
              {isPremium ? "Premium" : "Free"}
            </span>
          </div>
          {usage ? (
            <div className="mt-7">
              <div className="flex items-end justify-between gap-4">
                <p className="text-sm text-gray-600">Searches used this month (UTC)</p>
                <p className="text-sm font-semibold">
                  {usage.used_count}
                  {usage.search_limit !== null && usage.search_limit >= 0
                    ? ` / ${usage.search_limit}`
                    : " / not configured"}
                </p>
              </div>
              {usage.configured && (
                <p className="mt-2 text-right text-xs text-gray-500">
                  {usage.remaining === null
                    ? "Monthly allowance is not configured"
                    : `${usage.remaining} searches remaining this month`}
                </p>
              )}
              {usage.search_limit !== null && usage.search_limit > 0 && (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 to-purple-600"
                    style={{
                      width: `${Math.min(100, (usage.used_count / usage.search_limit) * 100)}%`,
                    }}
                  />
                </div>
              )}
              {!usage.configured && (
                <p className="mt-4 text-sm text-amber-800">
                  Configure a non-negative monthly search limit in the plan catalog before searches can be used.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-6 text-sm text-gray-600">Apply the database migration to load plan usage.</p>
          )}

          {subscription?.stripe_customer_id ? (
            <div className="mt-7 rounded-2xl bg-blue-50 p-4">
              <p className="text-sm font-semibold text-blue-900">
                {isPremium
                  ? `Subscription ${subscription.cancel_at_period_end ? "ends" : "renews"} ${
                      subscription.current_period_end
                        ? new Date(subscription.current_period_end).toLocaleDateString()
                        : "according to Stripe"
                    }`
                  : `Subscription status: ${subscription.status}. Manage billing or payment details in Stripe.`}
              </p>
              <form action={openSubscriptionPortal} className="mt-4">
                <button className="min-h-11 rounded-xl bg-white px-4 text-sm font-semibold text-blue-800 shadow-sm hover:bg-blue-100">
                  Manage subscription
                </button>
              </form>
            </div>
          ) : (
            <form action={startPremiumCheckout} className="mt-7">
              <button
                disabled={!stripeReady}
                className="min-h-12 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Upgrade to Premium
              </button>
              {(!stripeReady ||
                premiumPlan.search_limit === null ||
                premiumPlan.search_limit < 0) && (
                <p className="mt-3 text-xs leading-5 text-gray-500">
                  Configure Premium pricing and usage in the plan catalog, Stripe test keys, and a Premium test Price ID to enable checkout.
                </p>
              )}
            </form>
          )}
        </article>

        <aside className="rounded-3xl border border-gray-200 bg-white p-6">
          <p className="text-sm font-medium text-gray-500">Available plans</p>
          <div className="mt-4 space-y-4">
            {[freePlan, premiumPlan].map((plan) => (
              <div key={plan.id} className="rounded-2xl border border-gray-100 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-semibold">{plan.name}</h3>
                  <span className="text-right text-sm font-semibold">
                    {getPlanPriceLabel(plan)}
                    {plan.price_display !== "Free" &&
                      plan.currency &&
                      !plan.currency.startsWith("CONFIGURE_") &&
                      ` · ${plan.currency}`}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-gray-500">{plan.description}</p>
                <p className="mt-2 text-xs font-medium text-gray-700">
                  {getPlanLimitLabel(plan.search_limit, plan.id)}
                </p>
              </div>
            ))}
          </div>
          <Link href="/pricing" className="mt-5 inline-block text-sm font-semibold text-blue-700 hover:text-blue-900">
            View public plan details →
          </Link>
        </aside>
      </div>
    </section>
  );
}

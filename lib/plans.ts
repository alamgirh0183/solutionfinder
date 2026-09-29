export type Plan = {
  id: "free" | "premium";
  name: string;
  description: string;
  price_display: string;
  currency: string;
  interval: string;
  search_limit: number | null;
  features: string[];
};

export const planPlaceholders: Plan[] = [
  {
    id: "free",
    name: "Free",
    description: "Explore SolutionFinder and save the recommendations you need.",
    price_display: "Free",
    currency: "",
    interval: "month",
    search_limit: 10,
    features: [
      "AI-powered solution discovery",
      "Personal search history",
      "Saved solutions",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    description: "More room to research, organize, and find the right tools.",
    price_display: "CONFIGURE_PREMIUM_PRICE",
    currency: "",
    interval: "month",
    search_limit: 100,
    features: [
      "Everything in Free",
      "Stripe subscription management",
    ],
  },
];

export function getPlanLimitLabel(limit: number | null, id: string) {
  if (limit === null || limit < 0) {
    return id === "free"
      ? "Monthly search allowance unavailable"
      : "Premium monthly search allowance unavailable";
  }
  return `${limit} searches per month`;
}

export function getPlanPriceLabel(plan: Plan) {
  if (plan.price_display === "Free") return plan.price_display;
  return plan.price_display.startsWith("CONFIGURE_")
    ? "Price to be announced"
    : plan.price_display;
}

export function getPlanFeatureLabel(feature: string) {
  if (feature === "CONFIGURE_FREE_MONTHLY_SEARCH_LIMIT") {
    return "Monthly search allowance unavailable";
  }
  if (feature === "CONFIGURE_PREMIUM_MONTHLY_SEARCH_LIMIT") {
    return "Premium monthly search allowance unavailable";
  }
  return feature.startsWith("CONFIGURE_") ? "Plan details coming soon" : feature;
}

export function isPlanConfigured(plan: Plan) {
  return (
    plan.search_limit !== null &&
    plan.search_limit >= 0 &&
    !plan.price_display.startsWith("CONFIGURE_") &&
    !plan.currency.startsWith("CONFIGURE_") &&
    !plan.features.some((feature) => feature.startsWith("CONFIGURE_"))
  );
}

import "server-only";

import Stripe from "stripe";

export function createTestStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Stripe test mode is not configured: STRIPE_SECRET_KEY is missing.");
  }
  if (!secretKey.startsWith("sk_test_")) {
    throw new Error(
      "Stripe is restricted to test mode. STRIPE_SECRET_KEY must start with sk_test_."
    );
  }

  return new Stripe(secretKey);
}

export function getSiteUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return siteUrl.replace(/\/$/, "");
}

import Stripe from "stripe";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTestStripeClient } from "@/lib/stripe/server";

export const runtime = "nodejs";

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function stripeObjectId(value: unknown): string | null {
  if (typeof value === "string") return value;
  const object = record(value);
  return object && typeof object.id === "string" ? object.id : null;
}

function invoiceSubscriptionId(value: unknown): string | null {
  const invoice = record(value);
  const direct = stripeObjectId(invoice?.subscription);
  if (direct) return direct;
  const parent = record(invoice?.parent);
  const details = record(parent?.subscription_details);
  return stripeObjectId(details?.subscription);
}

function asUserId(value: unknown): string | null {
  if (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  ) {
    return value;
  }
  return null;
}

async function persistSubscription(
  admin: ReturnType<typeof createAdminClient>,
  subscription: Stripe.Subscription,
  userId: string | null,
  forcedStatus?: string
) {
  const customerId = stripeObjectId(subscription.customer);
  if (!userId && !customerId) {
    throw new Error("The Stripe subscription has no account mapping.");
  }

  const subscriptionItem = subscription.items.data[0];
  const row = {
    ...(userId ? { user_id: userId } : {}),
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: subscriptionItem?.price.id ?? null,
    status: forcedStatus ?? subscription.status,
    current_period_end: subscriptionItem?.current_period_end
      ? new Date(subscriptionItem.current_period_end * 1000).toISOString()
      : null,
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  };

  if (userId) {
    const { error } = await admin
      .from("subscriptions")
      .upsert(row, { onConflict: "user_id" });
    if (error) {
      throw new Error(`Unable to sync the Stripe subscription: ${error.message}`);
    }
    return;
  }

  const { data, error } = await admin
    .from("subscriptions")
    .update(row)
    .eq("stripe_customer_id", customerId)
    .select("user_id")
    .maybeSingle();
  if (error || !data) {
    throw new Error(
      error
        ? `Unable to sync the Stripe subscription: ${error.message}`
        : "The Stripe customer is not linked to a SolutionFinder account."
    );
  }
}

async function handleEvent(event: Stripe.Event) {
  const admin = createAdminClient();
  const stripe = createTestStripeClient();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    if (session.mode !== "subscription" || session.status !== "complete") return;

    const subscriptionId = stripeObjectId(session.subscription);
    if (!subscriptionId) {
      throw new Error("Completed subscription checkout has no subscription ID.");
    }
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const userId = asUserId(
      subscription.metadata.user_id ??
        session.metadata?.user_id ??
        session.client_reference_id
    );
    if (!userId) {
      throw new Error("Completed subscription checkout has no valid user mapping.");
    }

    const expectedPriceId = process.env.STRIPE_PREMIUM_PRICE_ID;
    const actualPriceId = subscription.items.data[0]?.price.id;
    if (!expectedPriceId || actualPriceId !== expectedPriceId) {
      console.error("Ignoring a checkout for an unconfigured Stripe price.");
      return;
    }
    await persistSubscription(admin, subscription, userId);
    return;
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = await stripe.subscriptions.retrieve(event.data.object.id);
    const userId = asUserId(subscription.metadata.user_id);
    const expectedPriceId = process.env.STRIPE_PREMIUM_PRICE_ID;
    if (subscription.items.data[0]?.price.id !== expectedPriceId) {
      console.error("Ignoring a subscription event for an unconfigured Stripe price.");
      await persistSubscription(admin, subscription, userId, "unpaid");
      return;
    }
    await persistSubscription(admin, subscription, userId);
    return;
  }

  if (event.type === "invoice.payment_failed" || event.type === "invoice.paid") {
    const invoice = event.data.object;
    let subscriptionId = invoiceSubscriptionId(invoice);
    let mappedUserId: string | null = null;
    if (!subscriptionId) {
      const customerId = stripeObjectId(record(invoice)?.customer);
      if (customerId) {
        const { data: existing, error } = await admin
          .from("subscriptions")
          .select("user_id,stripe_subscription_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();
        if (error) {
          throw new Error(`Unable to map a Stripe invoice to a user: ${error.message}`);
        }
        subscriptionId = existing?.stripe_subscription_id ?? null;
        mappedUserId = existing?.user_id ?? null;
      }
    }
    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const userId = asUserId(subscription.metadata.user_id) ?? mappedUserId;
      const expectedPriceId = process.env.STRIPE_PREMIUM_PRICE_ID;
      await persistSubscription(
        admin,
        subscription,
        userId,
        subscription.items.data[0]?.price.id === expectedPriceId
          ? undefined
          : "unpaid"
      );
    }
  }
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook verification is not configured." },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    const payload = await request.text();
    event = createTestStripeClient().webhooks.constructEvent(
      payload,
      signature,
      webhookSecret
    );
  } catch (error) {
    console.error(
      "Stripe webhook signature verification failed:",
      error instanceof Error ? error.message : "Invalid signature."
    );
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  if (event.livemode) {
    console.error("Rejected a live-mode Stripe event on the test-only webhook.");
    return NextResponse.json(
      { error: "This endpoint accepts Stripe test-mode events only." },
      { status: 400 }
    );
  }

  try {
    const admin = createAdminClient();
    const { data: previous, error: lookupError } = await admin
      .from("stripe_webhook_events")
      .select("processed_at")
      .eq("event_id", event.id)
      .maybeSingle();
    if (lookupError) {
      throw new Error(`Unable to check webhook event idempotency: ${lookupError.message}`);
    }
    if (previous?.processed_at) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    if (!previous) {
      const { error: insertError } = await admin.from("stripe_webhook_events").insert({
        event_id: event.id,
        event_type: event.type,
      });
      if (insertError) {
        const { data: racedEvent, error: raceError } = await admin
          .from("stripe_webhook_events")
          .select("processed_at")
          .eq("event_id", event.id)
          .maybeSingle();
        if (raceError || racedEvent?.processed_at || !racedEvent) {
          if (racedEvent?.processed_at) {
            return NextResponse.json({ received: true, duplicate: true });
          }
          throw new Error("Unable to reserve the Stripe webhook event for processing.");
        }
      }
    }

    await handleEvent(event);

    const { error: processedError } = await admin
      .from("stripe_webhook_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("event_id", event.id);
    if (processedError) {
      throw new Error(`Unable to mark the Stripe event as processed: ${processedError.message}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(
      "Stripe webhook processing failed:",
      error instanceof Error ? error.message : "Unknown webhook error."
    );
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}

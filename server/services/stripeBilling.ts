import Stripe from "stripe";
import { storage } from "../storage.js";

export const STRIPE_PRO_PRICE_ID =
  process.env.STRIPE_PRO_PRICE_ID || "price_1TTUzQCy6PByA3b62RruIZL4";

export const STRIPE_PRO_PAYMENT_LINK_URL =
  process.env.STRIPE_PRO_PAYMENT_LINK_URL ||
  "https://buy.stripe.com/test_aFa6oG20Q55y2Kz0ureEo00";

let stripeClient: Stripe | null | undefined;

function getStripe(): Stripe | null {
  if (stripeClient !== undefined) return stripeClient;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  stripeClient = secretKey ? new Stripe(secretKey) : null;
  return stripeClient;
}

function resolveAppOrigin(origin?: string | null): string {
  return (
    origin ||
    process.env.VITE_APP_DOMAIN ||
    process.env.APP_URL ||
    "http://localhost:5001"
  ).replace(/\/$/, "");
}

function timestampToDate(value?: number | null): Date {
  return value ? new Date(value * 1000) : new Date();
}

function addOneMonth(date: Date): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next;
}

export async function createProCheckoutSession(input: {
  userId: string;
  userEmail?: string | null;
  organizationId: string;
  organizationName?: string | null;
  origin?: string | null;
}): Promise<{ url: string; source: "checkout_session" | "payment_link" }> {
  const stripe = getStripe();
  if (!stripe) {
    return { url: STRIPE_PRO_PAYMENT_LINK_URL, source: "payment_link" };
  }

  const appOrigin = resolveAppOrigin(input.origin);
  const metadata = {
    userId: input.userId,
    organizationId: input.organizationId,
    plan: "pro",
  };

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: input.userEmail || undefined,
    client_reference_id: input.userId,
    line_items: [{ price: STRIPE_PRO_PRICE_ID, quantity: 1 }],
    success_url: `${appOrigin}/app?checkout=success`,
    cancel_url: `${appOrigin}/pricing?checkout=canceled`,
    allow_promotion_codes: true,
    metadata,
    subscription_data: {
      metadata,
      description: input.organizationName
        ? `Granted AI Pro for ${input.organizationName}`
        : "Granted AI Pro",
    },
  });

  if (!session.url) {
    throw new Error("Stripe checkout session did not return a URL");
  }

  return { url: session.url, source: "checkout_session" };
}

async function upsertProSubscription(input: {
  organizationId: string;
  status: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean | null;
}) {
  const currentPeriodStart = input.currentPeriodStart || new Date();
  const currentPeriodEnd = input.currentPeriodEnd || addOneMonth(currentPeriodStart);
  const existing = await storage.getSubscription(input.organizationId);

  if (existing) {
    await storage.updateSubscription(existing.id, {
      plan: "pro",
      status: input.status,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
      stripeCustomerId: input.stripeCustomerId ?? existing.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId ?? existing.stripeSubscriptionId,
    } as any);
  } else {
    const subscription = await storage.createSubscription({
      organizationId: input.organizationId,
      plan: "pro",
      status: input.status,
      currentPeriodStart,
      currentPeriodEnd,
    });
    await storage.updateSubscription(subscription.id, {
      stripeCustomerId: input.stripeCustomerId ?? null,
      stripeSubscriptionId: input.stripeSubscriptionId ?? null,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
    } as any);
  }

  await storage.updateOrganization(input.organizationId, {
    plan: input.status === "active" || input.status === "trialing" ? "pro" : "starter",
    billingCustomerId: input.stripeCustomerId ?? undefined,
  } as any);
}

function getId(value: string | { id?: string } | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id || null;
}

export async function handleStripeWebhook(rawBody: Buffer, signature: string | undefined) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    throw new Error("Stripe webhook is not configured");
  }

  if (!signature) {
    throw new Error("Missing Stripe signature");
  }

  const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "subscription" || session.metadata?.plan !== "pro") {
      return event;
    }

    const organizationId = session.metadata?.organizationId;
    const subscriptionId = getId(session.subscription);
    if (!organizationId || !subscriptionId) {
      return event;
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await upsertProSubscription({
      organizationId,
      status: subscription.status,
      stripeCustomerId: getId(subscription.customer) || getId(session.customer),
      stripeSubscriptionId: subscription.id,
      currentPeriodStart: timestampToDate((subscription as any).current_period_start),
      currentPeriodEnd: timestampToDate((subscription as any).current_period_end),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const organizationId = subscription.metadata?.organizationId;
    if (!organizationId || subscription.metadata?.plan !== "pro") {
      return event;
    }

    await upsertProSubscription({
      organizationId,
      status: event.type === "customer.subscription.deleted" ? "canceled" : subscription.status,
      stripeCustomerId: getId(subscription.customer),
      stripeSubscriptionId: subscription.id,
      currentPeriodStart: timestampToDate((subscription as any).current_period_start),
      currentPeriodEnd: timestampToDate((subscription as any).current_period_end),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
  }

  return event;
}

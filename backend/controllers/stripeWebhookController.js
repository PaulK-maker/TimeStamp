const Tenant = require("../models/Tenant");
const {
  getStripeClient,
  getPlanIdForStripePriceId,
  isSubscriptionAccessEnabled,
} = require("../config/stripeBilling");

async function findTenantFromEventObject(object) {
  const metadataTenantId = object?.metadata?.tenantId;
  if (metadataTenantId) {
    const byId = await Tenant.findById(metadataTenantId);
    if (byId) return byId;
  }

  const customerId =
    typeof object?.customer === "string"
      ? object.customer
      : object?.customer?.id || null;
  if (customerId) {
    const byCustomer = await Tenant.findOne({ stripeCustomerId: customerId });
    if (byCustomer) return byCustomer;
  }

  const subscriptionId =
    typeof object?.subscription === "string"
      ? object.subscription
      : object?.subscription?.id || object?.id || null;
  if (subscriptionId) {
    const bySubscription = await Tenant.findOne({ stripeSubscriptionId: subscriptionId });
    if (bySubscription) return bySubscription;
  }

  return null;
}

async function applySubscriptionToTenant(tenant, subscription) {
  if (!tenant || !subscription) return;

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id || null;
  const priceId = subscription.items?.data?.[0]?.price?.id || null;
  const mappedPlanId = getPlanIdForStripePriceId(priceId);
  const subscriptionStatus = subscription.status || null;

  if (customerId) tenant.stripeCustomerId = customerId;
  tenant.stripeSubscriptionId = subscription.id || tenant.stripeSubscriptionId;
  tenant.stripePriceId = priceId;
  tenant.subscriptionStatus = subscriptionStatus;
  tenant.currentPeriodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : null;

  if (mappedPlanId) {
    tenant.planId = mappedPlanId;
  }

  tenant.planSelected = Boolean(mappedPlanId && isSubscriptionAccessEnabled(subscriptionStatus));
  await tenant.save();
}

async function handleCheckoutCompleted(session) {
  const tenant = await findTenantFromEventObject(session);
  if (!tenant) return;

  if (session.customer) {
    tenant.stripeCustomerId = session.customer;
  }

  if (session.subscription) {
    tenant.stripeSubscriptionId = session.subscription;
  }

  await tenant.save();

  if (session.subscription) {
    const stripe = getStripeClient();
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    await applySubscriptionToTenant(tenant, subscription);
  }
}

async function handleInvoicePaymentFailed(invoice) {
  const tenant = await findTenantFromEventObject(invoice);
  if (!tenant) return;

  tenant.subscriptionStatus = "past_due";
  if (!isSubscriptionAccessEnabled(tenant.subscriptionStatus)) {
    tenant.planSelected = false;
  }
  await tenant.save();
}

async function handleInvoicePaymentSucceeded(invoice) {
  const tenant = await findTenantFromEventObject(invoice);
  if (!tenant) return;

  if (tenant.subscriptionStatus === "past_due") {
    tenant.subscriptionStatus = "active";
    tenant.planSelected = true;
    await tenant.save();
  }
}

async function stripeWebhookHandler(req, res) {
  const stripeSignature = req.headers["stripe-signature"];
  const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET || "").trim();

  if (!webhookSecret) {
    return res.status(500).json({
      message: "Stripe webhook secret is not configured.",
      code: "STRIPE_WEBHOOK_SECRET_MISSING",
    });
  }

  let event;

  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(req.body, stripeSignature, webhookSecret);
  } catch (error) {
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const tenant = await findTenantFromEventObject(event.data.object);
        if (tenant) {
          await applySubscriptionToTenant(tenant, event.data.object);
        }
        break;
      }
      case "customer.subscription.deleted": {
        const tenant = await findTenantFromEventObject(event.data.object);
        if (tenant) {
          await applySubscriptionToTenant(tenant, event.data.object);
          tenant.planSelected = false;
          tenant.subscriptionStatus = event.data.object.status || "canceled";
          await tenant.save();
        }
        break;
      }
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object);
        break;
      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      default:
        break;
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook handling failed:", error);
    return res.status(500).json({
      message: "Stripe webhook processing failed",
      detail: process.env.NODE_ENV !== "production" ? error.message : undefined,
    });
  }
}

module.exports = {
  stripeWebhookHandler,
};
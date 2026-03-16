const Tenant = require("../models/Tenant");
const { getPlan, listPlans } = require("../config/plans");
const {
  getStripeClient,
  getStripePriceIdForPlan,
  getPlanBillingType,
  isPaidPlan,
  isSubscriptionAccessEnabled,
  buildStripeReturnUrl,
} = require("../config/stripeBilling");

function serializePlan(plan) {
  if (!plan) return null;

  return {
    ...plan,
    billingType: getPlanBillingType(plan.id),
    stripePriceId: getStripePriceIdForPlan(plan.id),
  };
}

function serializeTenantBilling(tenant) {
  const plan = tenant?.planId ? getPlan(tenant.planId) : null;
  const paidPlan = Boolean(plan && isPaidPlan(plan.id));
  const subscriptionActive = paidPlan
    ? isSubscriptionAccessEnabled(tenant.subscriptionStatus)
    : Boolean(tenant?.planSelected && plan);
  const accessGranted = Boolean(plan && tenant.planSelected && (!paidPlan || subscriptionActive));

  return {
    tenant: {
      id: tenant._id.toString(),
      name: tenant.name,
      tenantCode: tenant.tenantCode || null,
      planSelected: tenant.planSelected,
      planId: tenant.planId,
      stripeCustomerId: tenant.stripeCustomerId || null,
      stripeSubscriptionId: tenant.stripeSubscriptionId || null,
      stripePriceId: tenant.stripePriceId || null,
      subscriptionStatus: tenant.subscriptionStatus || null,
      currentPeriodEnd: tenant.currentPeriodEnd || null,
    },
    plan: serializePlan(plan),
    billing: {
      billingType: plan ? getPlanBillingType(plan.id) : null,
      subscriptionActive,
      accessGranted,
      requiresCheckout: Boolean(plan && paidPlan && !subscriptionActive),
      canManagePortal: Boolean(tenant.stripeCustomerId),
      checkoutPending: Boolean(plan && paidPlan && !tenant.planSelected),
      invoicesEnabled: Boolean(tenant.stripeCustomerId),
    },
  };
}

async function requireTenant(req, res) {
  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    res.status(403).json({
      message: "Tenant is not assigned for this account.",
      code: "TENANT_REQUIRED",
    });
    return null;
  }

  const tenant = await Tenant.findById(tenantId);
  if (!tenant) {
    res.status(404).json({ message: "Tenant not found" });
    return null;
  }

  return tenant;
}

async function getOrCreateStripeCustomer(tenant) {
  if (tenant.stripeCustomerId) {
    return tenant.stripeCustomerId;
  }

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    name: tenant.name || "TimeStamp Facility",
    metadata: {
      tenantId: tenant._id.toString(),
      tenantCode: tenant.tenantCode || "",
    },
  });

  tenant.stripeCustomerId = customer.id;
  await tenant.save();
  return customer.id;
}

async function listAvailablePlans(req, res) {
  return res.json({ plans: listPlans().map(serializePlan) });
}

async function getMyBilling(req, res) {
  const tenant = await requireTenant(req, res);
  if (!tenant) return undefined;

  return res.json(serializeTenantBilling(tenant));
}

async function selectPlan(req, res) {
  const tenant = await requireTenant(req, res);
  if (!tenant) return undefined;

  const { planId } = req.body || {};
  const plan = getPlan(planId);
  if (!plan) {
    return res.status(400).json({ message: "Invalid planId" });
  }

  if (isPaidPlan(plan.id)) {
    const stripePriceId = getStripePriceIdForPlan(plan.id);
    if (!stripePriceId) {
      return res.status(500).json({
        message: `Stripe price is not configured for plan ${plan.id}.`,
        code: "STRIPE_PRICE_NOT_CONFIGURED",
      });
    }

    const alreadyActive =
      tenant.planId === plan.id &&
      tenant.planSelected &&
      isSubscriptionAccessEnabled(tenant.subscriptionStatus);

    if (alreadyActive) {
      return res.json({
        mode: "already_active",
        ...serializeTenantBilling(tenant),
      });
    }

    return res.json({
      mode: "checkout_required",
      ...serializeTenantBilling(tenant),
      checkoutContext: {
        planId: plan.id,
        stripePriceId,
      },
    });
  }

  if (tenant.stripeSubscriptionId && isSubscriptionAccessEnabled(tenant.subscriptionStatus)) {
    return res.status(409).json({
      message: "Cancel the current paid subscription in the billing portal before switching to the Free plan.",
      code: "PAID_SUBSCRIPTION_ACTIVE",
    });
  }

  tenant.planId = plan.id;
  tenant.planSelected = true;
  tenant.stripeSubscriptionId = null;
  tenant.stripePriceId = null;
  tenant.subscriptionStatus = null;
  tenant.currentPeriodEnd = null;
  await tenant.save();

  return res.json({
    mode: "immediate",
    message: "Plan selected",
    ...serializeTenantBilling(tenant),
  });
}

async function createCheckoutSession(req, res) {
  const tenant = await requireTenant(req, res);
  if (!tenant) return undefined;

  const { planId, returnPath } = req.body || {};
  const plan = getPlan(planId);
  if (!plan || !isPaidPlan(plan.id)) {
    return res.status(400).json({ message: "A paid plan is required for checkout." });
  }

  const stripePriceId = getStripePriceIdForPlan(plan.id);
  if (!stripePriceId) {
    return res.status(500).json({
      message: `Stripe price is not configured for plan ${plan.id}.`,
      code: "STRIPE_PRICE_NOT_CONFIGURED",
    });
  }

  const customerId = await getOrCreateStripeCustomer(tenant);
  const stripe = getStripeClient();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      {
        price: stripePriceId,
        quantity: 1,
      },
    ],
    success_url: buildStripeReturnUrl({
      type: "success",
      returnPath: returnPath || "/admin/billing?checkout=success",
    }),
    cancel_url: buildStripeReturnUrl({
      type: "cancel",
      returnPath: returnPath || "/admin/billing?checkout=cancel",
    }),
    metadata: {
      tenantId: tenant._id.toString(),
      tenantCode: tenant.tenantCode || "",
      planId: plan.id,
      adminUserId: req.user?.id || "",
      adminEmail: req.user?.email || "",
    },
    subscription_data: {
      metadata: {
        tenantId: tenant._id.toString(),
        tenantCode: tenant.tenantCode || "",
        planId: plan.id,
      },
    },
    client_reference_id: tenant._id.toString(),
    allow_promotion_codes: false,
  });

  return res.json({
    url: session.url,
    sessionId: session.id,
    tenantId: tenant._id.toString(),
    planId: plan.id,
  });
}

async function createPortalSession(req, res) {
  const tenant = await requireTenant(req, res);
  if (!tenant) return undefined;

  if (!tenant.stripeCustomerId) {
    return res.status(400).json({
      message: "This facility does not have a Stripe customer yet.",
      code: "STRIPE_CUSTOMER_REQUIRED",
    });
  }

  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: tenant.stripeCustomerId,
    return_url: buildStripeReturnUrl({
      type: "portal",
      returnPath: req.body?.returnPath || "/admin/billing",
    }),
  });

  return res.json({ url: session.url });
}

async function listInvoices(req, res) {
  const tenant = await requireTenant(req, res);
  if (!tenant) return undefined;

  if (!tenant.stripeCustomerId) {
    return res.json({ invoices: [] });
  }

  const stripe = getStripeClient();
  const invoiceList = await stripe.invoices.list({
    customer: tenant.stripeCustomerId,
    limit: 12,
  });

  return res.json({
    invoices: (invoiceList.data || []).map((invoice) => ({
      id: invoice.id,
      status: invoice.status || null,
      amountDue: invoice.amount_due,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
      hostedInvoiceUrl: invoice.hosted_invoice_url || null,
      invoicePdf: invoice.invoice_pdf || null,
      periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
      periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
      createdAt: invoice.created ? new Date(invoice.created * 1000) : null,
    })),
  });
}

module.exports = {
  listAvailablePlans,
  getMyBilling,
  selectPlan,
  createCheckoutSession,
  createPortalSession,
  listInvoices,
  serializeTenantBilling,
};

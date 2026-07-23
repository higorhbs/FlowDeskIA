import {
  getPaymentsByMpPaymentId,
  getBusinessMercadoPagoIntegration,
  updatePayment,
  updatePaymentsByMpPaymentId,
  getTenant,
  getTenantByStripeCustomerId,
  updateTenant,
} from '@flowdesk/firebase'
import { json } from '../../lib/auth-guard.js'
import {
  getSubscriptionAccessEndIso,
  getSubscriptionCanceledAtIso,
  isSubscriptionCancelPending,
  subscriptionCancelPatch,
} from '../../services/stripe-subscription.js'
import {
  fetchMercadoPagoPayment,
  getValidMercadoPagoAccessToken,
} from '../../services/mercadopago.js'
import { notifyPaymentReceived } from '../../../dist/whatsapp/services/payment-notify.js'
import Stripe from 'stripe'

function planFromPriceId(priceId) {
  if (!priceId) return null
  if (priceId === process.env.STRIPE_PRICE_STARTER) return 'STARTER'
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'PRO'
  if (priceId === process.env.STRIPE_PRICE_UNLIMITED) return 'UNLIMITED'
  return null
}

function parseExternalReference(ref) {
  if (!ref || typeof ref !== 'string') return null
  const [businessId, paymentId] = ref.split(':')
  if (!businessId || !paymentId) return null
  return { businessId, paymentId }
}

export async function mercadopagoWebhookHandler(c) {
  let body = {}
  try {
    if (c.req.method !== 'GET') {
      body = await c.req.json()
    }
  } catch {
    body = {}
  }
  const paymentId = body?.data?.id ?? body?.id ?? c.req.query('data.id') ?? c.req.query('id')
  if (!paymentId) {
    return c.json({ received: true })
  }

  const mpId = String(paymentId)
  let linked = await getPaymentsByMpPaymentId(mpId)
  let businessId = linked[0]?.businessId

  let mpPayment = null
  if (businessId) {
    try {
      const tokenBundle = await getValidMercadoPagoAccessToken(businessId)
      if (tokenBundle?.accessToken) {
        mpPayment = await fetchMercadoPagoPayment(tokenBundle.accessToken, mpId)
      }
    } catch (err) {
      console.error('[webhooks] mercadopago fetch failed:', err)
    }
  }

  if (!mpPayment) {
    return c.json({ received: true })
  }

  if (!businessId) {
    const parsed = parseExternalReference(mpPayment.external_reference)
    if (parsed) {
      businessId = parsed.businessId
      const integration = await getBusinessMercadoPagoIntegration(businessId)
      if (!integration?.accessToken) {
        return c.json({ received: true })
      }
      linked = await getPaymentsByMpPaymentId(mpId)
      if (!linked.length && parsed.paymentId) {
        await updatePayment(businessId, parsed.paymentId, { mpPaymentId: mpId })
        linked = await getPaymentsByMpPaymentId(mpId)
      }
    }
  }

  const status = String(mpPayment.status || '')
  if (status === 'approved') {
    const before = linked.length ? linked : await getPaymentsByMpPaymentId(mpId)
    const paidAt = new Date().toISOString()
    await updatePaymentsByMpPaymentId(mpId, { status: 'PAID', paidAt })
    for (const p of before) {
      if (p.status !== 'PAID') {
        await notifyPaymentReceived({ ...p, status: 'PAID', paidAt })
      }
    }
  }

  if (status === 'cancelled' || status === 'rejected') {
    await updatePaymentsByMpPaymentId(mpId, { status: 'CANCELLED' })
  }

  if (status === 'expired') {
    await updatePaymentsByMpPaymentId(mpId, { status: 'OVERDUE' })
  }

  return c.json({ received: true })
}

export async function stripeWebhookHandler(c) {
  const key = process.env.STRIPE_SECRET_KEY
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!key || !secret) return json(c, 400, { error: 'Stripe não configurado' })

  const stripe = new Stripe(key)
  const signature = c.req.header('stripe-signature')
  if (!signature) {
    return json(c, 400, { error: 'Assinatura Stripe ausente' })
  }

  const raw = await c.req.text()
  let event
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret)
  } catch (err) {
    console.error('[webhooks] stripe signature failed:', err)
    return json(c, 400, { error: 'Assinatura Stripe inválida' })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
    const plan =
      planFromPriceId(session.metadata?.planPriceId) || session.metadata?.plan || null
    let tenant = customerId ? await getTenantByStripeCustomerId(customerId) : null
    if (!tenant && session.metadata?.tenantId) {
      tenant = await getTenant(String(session.metadata.tenantId))
    }
    if (tenant) {
      await updateTenant(tenant.id, {
        stripeCustomerId: customerId ?? tenant.stripeCustomerId,
        stripeSubscriptionId: subscriptionId ?? undefined,
        plan: plan ?? tenant.plan,
        planStatus: 'ACTIVE',
        cancelAtPeriodEnd: false,
      })
    }
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.created') {
    const sub = event.data.object
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
    const priceId = sub.items.data[0]?.price?.id
    const plan = planFromPriceId(priceId)
    const statusMap = {
      active: 'ACTIVE',
      trialing: 'TRIALING',
      past_due: 'PAST_DUE',
      canceled: 'CANCELED',
      unpaid: 'PAST_DUE',
    }
    let planStatus = statusMap[sub.status] ?? 'ACTIVE'
    if (customerId) {
      let tenant = await getTenantByStripeCustomerId(customerId)
      if (!tenant && sub.metadata?.tenantId) {
        tenant = await getTenant(String(sub.metadata.tenantId))
      }
      if (tenant) {
        const resolvedPlan = plan ?? tenant.plan
        if (resolvedPlan !== 'STARTER' && planStatus === 'TRIALING') planStatus = 'ACTIVE'
        const cancelPending = isSubscriptionCancelPending(sub)
        if (cancelPending && sub.status === 'active') planStatus = 'ACTIVE'
        const accessEnd = getSubscriptionAccessEndIso(sub)
        const patch = {
          stripeSubscriptionId: sub.id,
          stripePriceId: priceId,
          currentPeriodEnd:
            accessEnd ?? new Date(sub.current_period_end * 1000).toISOString(),
          plan: resolvedPlan,
          planStatus,
          ...subscriptionCancelPatch(sub, tenant),
        }
        if (sub.status === 'canceled') {
          patch.planStatus = 'CANCELED'
          patch.cancelAtPeriodEnd = false
        }
        await updateTenant(tenant.id, patch)
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id
    if (customerId) {
      const tenant = await getTenantByStripeCustomerId(customerId)
      if (tenant) {
        const accessEnd = getSubscriptionAccessEndIso(sub)
        const stillHasAccess = accessEnd ? Date.now() < new Date(accessEnd).getTime() : false
        await updateTenant(tenant.id, {
          planStatus: stillHasAccess ? 'ACTIVE' : 'CANCELED',
          stripeSubscriptionId: stillHasAccess ? sub.id : undefined,
          cancelAtPeriodEnd: stillHasAccess,
          currentPeriodEnd: accessEnd ?? tenant.currentPeriodEnd,
          canceledAt:
            tenant.canceledAt ?? getSubscriptionCanceledAtIso(sub) ?? new Date().toISOString(),
        })
      }
    }
  }

  return c.json({ received: true })
}

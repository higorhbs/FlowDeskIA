import Stripe from 'stripe'
import {
  getTenant,
  getTenantByStripeCustomerId,
  getBusinessAsaasIntegration,
  getPaymentsByAsaasId,
  updatePaymentsByAsaasId,
  updateTenant,
} from '@flowdesk/firebase'
import { json } from '../../lib/auth-guard.js'
import {
  getSubscriptionAccessEndIso,
  getSubscriptionCanceledAtIso,
  isSubscriptionCancelPending,
  subscriptionCancelPatch,
} from '../../services/stripe-subscription.js'
import { notifyPaymentReceived } from '../../../dist/whatsapp/services/payment-notify.js'

function optionalEnv(name) {
  const v = process.env[name]?.trim()
  return v || undefined
}

function planFromPriceId(priceId) {
  if (!priceId) return null
  if (priceId === process.env.STRIPE_PRICE_STARTER) return 'STARTER'
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'PRO'
  if (priceId === process.env.STRIPE_PRICE_UNLIMITED) return 'UNLIMITED'
  return null
}

export async function asaasWebhookHandler(c) {
  const event = await c.req.json().catch(() => ({}))
  const eventType = event.event
  const payment = event.payment
  const header = c.req.header('asaas-access-token')
  const globalToken = optionalEnv('ASAAS_WEBHOOK_TOKEN')

  if (payment?.id) {
    const linked = await getPaymentsByAsaasId(payment.id)
    const businessId = linked[0]?.businessId
    if (businessId) {
      const integration = await getBusinessAsaasIntegration(businessId)
      if (integration?.webhookToken) {
        if (header !== integration.webhookToken) {
          return json(c, 401, { error: 'Token do webhook inválido para este negócio' })
        }
      } else if (globalToken && header !== globalToken) {
        return json(c, 401, { error: 'Token do webhook Asaas inválido' })
      }
    } else if (globalToken && header !== globalToken) {
      return json(c, 401, { error: 'Token do webhook Asaas inválido' })
    }
  } else if (globalToken && header !== globalToken) {
    return json(c, 401, { error: 'Token do webhook Asaas inválido' })
  }

  if (!payment?.id) {
    return c.json({ received: true })
  }

  if (eventType === 'PAYMENT_RECEIVED' || eventType === 'PAYMENT_CONFIRMED') {
    const before = await getPaymentsByAsaasId(payment.id)
    const paidAt = new Date().toISOString()
    await updatePaymentsByAsaasId(payment.id, { status: 'PAID', paidAt })
    for (const p of before) {
      if (p.status !== 'PAID') {
        await notifyPaymentReceived({ ...p, status: 'PAID', paidAt })
      }
    }
  }

  if (eventType === 'PAYMENT_OVERDUE') {
    await updatePaymentsByAsaasId(payment.id, { status: 'OVERDUE' })
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

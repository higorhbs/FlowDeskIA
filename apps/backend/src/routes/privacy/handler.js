import { z } from 'zod'
import { getDb, getTenant, hasAdminCredential } from '@flowdesk/firebase'
import { json, requireBearerUser } from '../../lib/auth-guard.js'
import { runPrivacyRetentionForAllTenants } from '../../services/privacy-compliance.js'
import { deleteTenantAccountCompletely } from '../../services/delete-account.js'

const consentBody = z.object({
  policyVersion: z.string().min(3),
})

const requestBody = z.object({
  type: z.enum(['CORRECTION', 'OPPOSITION', 'REVOCATION', 'ERASURE']),
  details: z.string().max(2000).optional(),
})

function maskPhone(input) {
  const digits = String(input).replace(/\D/g, '')
  return digits ? `anon-${digits.slice(-4)}` : 'anon'
}

async function requirePrivacyAuth(c) {
  if (!hasAdminCredential()) {
    return {
      error: json(c, 503, {
        error: 'Credencial Firebase Admin ausente. Configure GOOGLE_APPLICATION_CREDENTIALS.',
      }),
    }
  }
  const auth = await requireBearerUser(c)
  if (auth.error) return auth
  return { tenantId: auth.decoded.uid }
}

async function anonymizeTenantData(tenantId) {
  const db = getDb()
  const businessesSnap = await db.collection('businesses').where('tenantId', '==', tenantId).get()

  for (const businessDoc of businessesSnap.docs) {
    const business = businessDoc.data()
    await businessDoc.ref.update({
      phone: maskPhone(String(business.phone ?? '')),
      address: null,
      description: null,
      updatedAt: new Date().toISOString(),
    })

    const conversationsSnap = await businessDoc.ref.collection('conversations').get()
    for (const convDoc of conversationsSnap.docs) {
      const conv = convDoc.data()
      await convDoc.ref.update({
        customerName: 'ANONIMIZADO',
        customerPhone: maskPhone(String(conv.customerPhone ?? '')),
      })
      const messagesSnap = await convDoc.ref.collection('messages').get()
      for (const msgDoc of messagesSnap.docs) {
        await msgDoc.ref.update({ content: '[ANONIMIZADO]' })
      }
    }

    const appointmentsSnap = await businessDoc.ref.collection('appointments').get()
    for (const aptDoc of appointmentsSnap.docs) {
      const apt = aptDoc.data()
      await aptDoc.ref.update({
        customerName: 'ANONIMIZADO',
        customerPhone: maskPhone(String(apt.customerPhone ?? '')),
        notes: null,
      })
    }

    const paymentsSnap = await businessDoc.ref.collection('payments').get()
    for (const payDoc of paymentsSnap.docs) {
      const pay = payDoc.data()
      await payDoc.ref.update({
        customerName: 'ANONIMIZADO',
        customerPhone: maskPhone(String(pay.customerPhone ?? '')),
      })
    }
  }
}

export async function privacyExportHandler(c) {
  const auth = await requirePrivacyAuth(c)
  if (auth.error) return auth.error

  const tenantId = auth.tenantId
  const db = getDb()
  const tenant = await getTenant(tenantId)
  if (!tenant) return json(c, 404, { error: 'Conta não encontrada' })

  const businessesSnap = await db.collection('businesses').where('tenantId', '==', tenantId).get()

  const businesses = await Promise.all(
    businessesSnap.docs.map(async (businessDoc) => {
      const businessId = businessDoc.id
      const [catalogSnap, faqsSnap, conversationsSnap, appointmentsSnap, paymentsSnap] =
        await Promise.all([
          db.collection('businesses').doc(businessId).collection('catalog').get(),
          db.collection('businesses').doc(businessId).collection('faqs').get(),
          db.collection('businesses').doc(businessId).collection('conversations').get(),
          db.collection('businesses').doc(businessId).collection('appointments').get(),
          db.collection('businesses').doc(businessId).collection('payments').get(),
        ])

      const conversations = await Promise.all(
        conversationsSnap.docs.map(async (convDoc) => {
          const messagesSnap = await db
            .collection('businesses')
            .doc(businessId)
            .collection('conversations')
            .doc(convDoc.id)
            .collection('messages')
            .get()
          return {
            id: convDoc.id,
            ...convDoc.data(),
            messages: messagesSnap.docs.map((m) => ({ id: m.id, ...m.data() })),
          }
        }),
      )

      return {
        id: businessId,
        ...businessDoc.data(),
        catalog: catalogSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        faqs: faqsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        conversations,
        appointments: appointmentsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        payments: paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      }
    }),
  )

  return c.json({
    exportedAt: new Date().toISOString(),
    tenant,
    businesses,
  })
}

export async function privacyConsentHandler(c) {
  const auth = await requirePrivacyAuth(c)
  if (auth.error) return auth.error

  const body = await c.req.json().catch(() => ({}))
  const { policyVersion } = consentBody.parse(body)
  const tenantId = auth.tenantId
  const db = getDb()
  const now = new Date().toISOString()

  await db.collection('tenants').doc(tenantId).update({
    lgpdAcceptedAt: now,
    lgpdPolicyVersion: policyVersion,
    updatedAt: now,
  })

  await db.collection('tenants').doc(tenantId).collection('privacy_audit').doc().set({
    type: 'CONSENT_ACCEPTED',
    policyVersion,
    acceptedAt: now,
    userAgent: c.req.header('user-agent') ?? '',
  })

  return c.json({ ok: true, acceptedAt: now, policyVersion })
}

export async function privacyRequestsHandler(c) {
  const auth = await requirePrivacyAuth(c)
  if (auth.error) return auth.error

  const body = await c.req.json().catch(() => ({}))
  const parsed = requestBody.parse(body)
  const tenantId = auth.tenantId
  const db = getDb()
  const now = new Date().toISOString()
  const ref = db.collection('tenants').doc(tenantId).collection('privacy_requests').doc()
  await ref.set({
    ...parsed,
    status: 'OPEN',
    createdAt: now,
    updatedAt: now,
    userAgent: c.req.header('user-agent') ?? '',
  })
  return c.json({ ok: true, requestId: ref.id })
}

export async function privacyDeleteAccountHandler(c) {
  const auth = await requirePrivacyAuth(c)
  if (auth.error) return auth.error

  try {
    await deleteTenantAccountCompletely(auth.tenantId)
    return c.json({ ok: true })
  } catch (err) {
    console.error('[privacy] delete-account failed:', err)
    return json(c, 500, {
      error: err instanceof Error ? err.message : 'Não foi possível excluir a conta.',
    })
  }
}

export async function privacyAnonymizeHandler(c) {
  const auth = await requirePrivacyAuth(c)
  if (auth.error) return auth.error

  const tenantId = auth.tenantId
  const db = getDb()
  await anonymizeTenantData(tenantId)
  await db.collection('tenants').doc(tenantId).update({
    name: 'ANONIMIZADO',
    email: `anon-${tenantId}@anonymized.local`,
    updatedAt: new Date().toISOString(),
  })
  await db.collection('tenants').doc(tenantId).collection('privacy_audit').doc().set({
    type: 'ANONYMIZATION_EXECUTED',
    executedAt: new Date().toISOString(),
    userAgent: c.req.header('user-agent') ?? '',
  })
  return c.json({ ok: true })
}

export async function privacyRetentionRunHandler(c) {
  const auth = await requirePrivacyAuth(c)
  if (auth.error) return auth.error

  const summary = await runPrivacyRetentionForAllTenants(365)
  return c.json({ ok: true, ...summary })
}

import { z } from 'zod'
import { getDb, getTenant, hasAdminCredential } from '@flowdesk/firebase'
import { json, requireBearerUser } from '../../lib/auth-guard.js'
import { deleteTenantAccountCompletely } from '../../services/delete-account.js'

const consentBody = z.object({
  policyVersion: z.string().min(3),
})

async function requirePrivacyAuth(c) {
  if (!hasAdminCredential()) {
    return {
      error: json(c, 503, {
        error: 'Credencial Firebase Admin ausente. Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY.',
      }),
    }
  }
  const auth = await requireBearerUser(c)
  if (auth.error) return auth
  return { tenantId: auth.decoded.uid }
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

  try {
    const body = await c.req.json().catch(() => ({}))
    const parsed = consentBody.safeParse(body)
    if (!parsed.success) {
      return json(c, 400, { error: 'Versão da política obrigatória.' })
    }
    const { policyVersion } = parsed.data
    const tenantId = auth.tenantId
    const db = getDb()
    const now = new Date().toISOString()
    const ref = db.collection('tenants').doc(tenantId)

    const snap = await ref.get()
    if (!snap.exists) {
      return json(c, 404, { error: 'Conta não encontrada' })
    }

    await ref.set(
      {
        lgpdAcceptedAt: now,
        lgpdPolicyVersion: policyVersion,
        updatedAt: now,
      },
      { merge: true },
    )

    await ref.collection('privacy_audit').add({
      type: 'CONSENT_ACCEPTED',
      policyVersion,
      acceptedAt: now,
      userAgent: c.req.header('user-agent') ?? '',
    })

    return c.json({ ok: true, acceptedAt: now, policyVersion })
  } catch (err) {
    console.error('[privacy] consent failed:', err)
    return json(c, 500, {
      error: err instanceof Error ? err.message : 'Não foi possível salvar o aceite LGPD.',
    })
  }
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

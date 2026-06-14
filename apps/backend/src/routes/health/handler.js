import { getAdminAuth, hasAdminCredential } from '@flowdesk/firebase'

export function healthHandler(c) {
  return c.json({
    status: 'ok',
    ok: true,
    ts: new Date().toISOString(),
    timestamp: new Date().toISOString(),
  })
}

export async function authHealthHandler(c) {
  const firebaseAdmin = hasAdminCredential()
  let customTokenReady = false
  let error = null

  if (firebaseAdmin) {
    try {
      const token = await getAdminAuth().createCustomToken('health-check')
      customTokenReady = Boolean(token?.trim())
      if (!customTokenReady) error = 'createCustomToken retornou vazio'
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    }
  } else {
    error =
      'Credencial Admin ausente. Dokploy: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (uma linha com \\n).'
  }

  return c.json({
    ok: firebaseAdmin && customTokenReady,
    firebaseAdmin,
    customTokenReady,
    ...(error ? { error } : {}),
  })
}

export function billingHealthHandler(c) {
  const stripeSecretKey = Boolean(process.env.STRIPE_SECRET_KEY?.trim())
  const prices = {
    STARTER: Boolean(process.env.STRIPE_PRICE_STARTER?.trim()),
    PRO: Boolean(process.env.STRIPE_PRICE_PRO?.trim()),
    UNLIMITED: Boolean(process.env.STRIPE_PRICE_UNLIMITED?.trim()),
  }
  const ok = stripeSecretKey && prices.STARTER && prices.PRO && prices.UNLIMITED
  return c.json({
    ok,
    stripeSecretKey,
    prices,
    webhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
  })
}

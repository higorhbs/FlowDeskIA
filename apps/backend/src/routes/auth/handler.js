import {
  createTenant,
  getAdminAuth,
  getTenant,
  hasAdminCredential,
  updateTenant,
} from '@flowdesk/firebase'
import { env } from '../../config/env.js'
import { adminAuthErrorMessage } from '../../lib/auth-errors.js'
import {
  sendVerifyEmailOob,
  signInWithGoogleAccessToken,
  signInWithPassword,
  signUpWithPassword,
} from '../../lib/firebase-identity.js'
import { ensureServerTenant } from '../../lib/tenant.js'

function json(c, status, body) {
  return c.json(body, status)
}

function requireApiKey(c) {
  if (!env.firebaseWebApiKey) {
    return json(c, 503, {
      error:
        'FIREBASE_WEB_API_KEY ausente. Use a mesma chave do NEXT_PUBLIC_FIREBASE_API_KEY.',
    })
  }
  if (!hasAdminCredential()) {
    return json(c, 503, {
      error:
        'Credencial Firebase Admin ausente. Configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY.',
    })
  }
  return null
}

function verificationContinueUrl(c) {
  const origin = c.req.header('Origin')?.trim()
  const base = origin || env.webOrigin?.split(',')[0]?.trim()
  if (!base?.startsWith('http')) return undefined
  return `${base.replace(/\/$/, '')}/?auth=register`
}

function requestUri(c) {
  const origin = c.req.header('Origin')?.trim()
  if (origin?.startsWith('http')) return origin
  const fallback = env.webOrigin?.split(',')[0]?.trim()
  return fallback?.startsWith('http') ? fallback : 'http://localhost:3000'
}

function readCredentials(body) {
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!email || !password) return null
  return { email, password }
}

async function issueVerifiedSession(c, uid, profile) {
  await ensureServerTenant(uid, profile)
  const customToken = await getAdminAuth().createCustomToken(uid)
  if (!customToken?.trim()) {
    throw new Error('Falha ao gerar customToken Firebase.')
  }
  return { status: 'VERIFIED', customToken, uid }
}

async function userVerified(uid) {
  const user = await getAdminAuth().getUser(uid)
  return user.emailVerified === true
}

async function sendVerification(c, idToken) {
  await sendVerifyEmailOob(env.firebaseWebApiKey, idToken, verificationContinueUrl(c))
}

export async function registerHandler(c) {
  const blocked = requireApiKey(c)
  if (blocked) return blocked

  const body = await c.req.json().catch(() => ({}))
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const creds = readCredentials(body)
  if (!creds || name.length < 2) {
    return json(c, 400, { error: 'Informe nome, e-mail e senha válidos.' })
  }

  try {
    const signedUp = await signUpWithPassword(
      env.firebaseWebApiKey,
      creds.email,
      creds.password
    )
    const uid = signedUp.localId
    await getAdminAuth().updateUser(uid, { displayName: name })
    await sendVerification(c, signedUp.idToken)
    return json(c, 201, { status: 'VERIFICATION_REQUIRED', email: creds.email })
  } catch (err) {
    if (err?.code === 'EMAIL_EXISTS' || String(err?.code).includes('EMAIL_EXISTS')) {
      return json(c, 409, { error: 'E-mail já cadastrado.', code: 'auth/email-already-in-use' })
    }
    return json(c, 400, { error: adminAuthErrorMessage(err) })
  }
}

export async function loginHandler(c) {
  const blocked = requireApiKey(c)
  if (blocked) return blocked

  const creds = readCredentials(await c.req.json().catch(() => ({})))
  if (!creds) return json(c, 400, { error: 'Informe e-mail e senha.' })

  try {
    const session = await signInWithPassword(
      env.firebaseWebApiKey,
      creds.email,
      creds.password
    )
    const uid = session.localId
    const verified = await userVerified(uid)
    if (!verified) {
      await sendVerification(c, session.idToken)
      return json(c, 403, {
        status: 'VERIFICATION_REQUIRED',
        email: creds.email,
      })
    }
    const user = await getAdminAuth().getUser(uid)
    const payload = await issueVerifiedSession(c, uid, {
      name: user.displayName ?? creds.email.split('@')[0],
      email: user.email ?? creds.email,
    })
    return json(c, 200, payload)
  } catch (err) {
    return json(c, 401, { error: adminAuthErrorMessage(err, 'Credenciais inválidas.') })
  }
}

export async function googleHandler(c) {
  const blocked = requireApiKey(c)
  if (blocked) return blocked

  const body = await c.req.json().catch(() => ({}))
  const accessToken =
    typeof body?.accessToken === 'string'
      ? body.accessToken
      : typeof body?.access_token === 'string'
        ? body.access_token
        : ''
  if (!accessToken) {
    return json(c, 400, { error: 'Token do Google ausente.' })
  }

  try {
    const session = await signInWithGoogleAccessToken(
      env.firebaseWebApiKey,
      accessToken,
      requestUri(c)
    )
    const uid = session.localId
    const user = await getAdminAuth().getUser(uid)
    if (user.emailVerified !== true) {
      return json(c, 403, {
        error: 'Confirme seu e-mail antes de continuar.',
        code: 'auth/email-not-verified',
      })
    }
    const email = user.email ?? session.email
    if (!email) return json(c, 400, { error: 'E-mail não encontrado na conta Google.' })
    const payload = await issueVerifiedSession(c, uid, {
      name: user.displayName ?? email.split('@')[0],
      email,
    })
    return json(c, 200, payload)
  } catch (err) {
    return json(c, 401, { error: adminAuthErrorMessage(err, 'Falha ao entrar com Google.') })
  }
}

async function bearerIdToken(c) {
  const header = c.req.header('Authorization')
  return header?.startsWith('Bearer ') ? header.slice(7) : null
}

async function requireBearerUser(c) {
  const token = await bearerIdToken(c)
  if (!token) return { error: json(c, 401, { error: 'Unauthorized' }) }
  try {
    const decoded = await getAdminAuth().verifyIdToken(token)
    if (decoded.email_verified !== true) {
      return {
        error: json(c, 403, { error: 'Confirme seu e-mail antes de acessar o painel.' }),
      }
    }
    return { decoded }
  } catch {
    return { error: json(c, 401, { error: 'Token inválido.' }) }
  }
}

async function verifyPassword(email, password) {
  await signInWithPassword(env.firebaseWebApiKey, email, password)
}

export async function resendVerificationSessionHandler(c) {
  const blocked = requireApiKey(c)
  if (blocked) return blocked

  const idToken = await bearerIdToken(c)
  if (!idToken) return json(c, 401, { error: 'Unauthorized' })

  try {
    await sendVerification(c, idToken)
    return json(c, 200, { ok: true })
  } catch (err) {
    return json(c, 400, { error: adminAuthErrorMessage(err) })
  }
}

export async function confirmVerificationSessionHandler(c) {
  const blocked = requireApiKey(c)
  if (blocked) return blocked

  const idToken = await bearerIdToken(c)
  if (!idToken) return json(c, 401, { error: 'Unauthorized' })

  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken)
    const user = await getAdminAuth().getUser(decoded.uid)
    if (user.emailVerified !== true) {
      return json(c, 403, {
        error: 'Seu e-mail ainda não foi confirmado.',
        code: 'auth/email-not-verified',
      })
    }
    const email = user.email ?? decoded.email
    if (!email) return json(c, 400, { error: 'E-mail não encontrado na conta.' })
    const payload = await issueVerifiedSession(c, decoded.uid, {
      name: user.displayName ?? email.split('@')[0],
      email,
    })
    return json(c, 200, payload)
  } catch (err) {
    return json(c, 401, { error: adminAuthErrorMessage(err) })
  }
}

export async function resendVerificationHandler(c) {
  const blocked = requireApiKey(c)
  if (blocked) return blocked

  const creds = readCredentials(await c.req.json().catch(() => ({})))
  if (!creds) return json(c, 400, { error: 'Informe e-mail e senha.' })

  try {
    const session = await signInWithPassword(
      env.firebaseWebApiKey,
      creds.email,
      creds.password
    )
    await sendVerification(c, session.idToken)
    return json(c, 200, { ok: true })
  } catch (err) {
    return json(c, 401, { error: adminAuthErrorMessage(err) })
  }
}

export async function confirmVerificationHandler(c) {
  const blocked = requireApiKey(c)
  if (blocked) return blocked

  const creds = readCredentials(await c.req.json().catch(() => ({})))
  if (!creds) return json(c, 400, { error: 'Informe e-mail e senha.' })

  try {
    const session = await signInWithPassword(
      env.firebaseWebApiKey,
      creds.email,
      creds.password
    )
    const uid = session.localId
    const user = await getAdminAuth().getUser(uid)
    if (user.emailVerified !== true) {
      return json(c, 403, {
        error: 'Seu e-mail ainda não foi confirmado.',
        code: 'auth/email-not-verified',
      })
    }
    const payload = await issueVerifiedSession(c, uid, {
      name: user.displayName ?? creds.email.split('@')[0],
      email: user.email ?? creds.email,
    })
    return json(c, 200, payload)
  } catch (err) {
    return json(c, 401, { error: adminAuthErrorMessage(err) })
  }
}

export async function completeOnboardingHandler(c) {
  const blocked = requireApiKey(c)
  if (blocked) return blocked

  const auth = await requireBearerUser(c)
  if (auth.error) return auth.error

  try {
    const tenant = await updateTenant(auth.decoded.uid, {
      onboardingCompletedAt: new Date().toISOString(),
    })
    if (!tenant) return json(c, 404, { error: 'Conta não encontrada' })
    return json(c, 200, tenant)
  } catch (err) {
    return json(c, 500, { error: adminAuthErrorMessage(err, 'Erro ao concluir onboarding.') })
  }
}

export async function syncHandler(c) {
  const blocked = requireApiKey(c)
  if (blocked) return blocked

  const auth = await requireBearerUser(c)
  if (auth.error) return auth.error

  try {
    const body = await c.req.json().catch(() => ({}))
    const name = typeof body?.name === 'string' ? body.name.trim() : undefined
    const email = auth.decoded.email
    if (!email) return json(c, 400, { error: 'E-mail não encontrado na conta.' })

    let tenant = await getTenant(auth.decoded.uid)
    if (tenant) return json(c, 200, tenant)

    tenant = await createTenant(auth.decoded.uid, {
      name: name ?? email.split('@')[0] ?? 'Usuário',
      email,
    })
    return json(c, 201, tenant)
  } catch (err) {
    return json(c, 500, { error: adminAuthErrorMessage(err, 'Erro ao sincronizar perfil.') })
  }
}

export async function updateProfileNameHandler(c) {
  const blocked = requireApiKey(c)
  if (blocked) return blocked

  const auth = await requireBearerUser(c)
  if (auth.error) return auth.error

  const body = await c.req.json().catch(() => ({}))
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (name.length < 2) return json(c, 400, { error: 'Nome muito curto.' })

  try {
    await getAdminAuth().updateUser(auth.decoded.uid, { displayName: name })
    const tenant = await updateTenant(auth.decoded.uid, { name })
    return json(c, 200, tenant ?? { ok: true })
  } catch (err) {
    return json(c, 400, { error: adminAuthErrorMessage(err) })
  }
}

export async function updateProfileEmailHandler(c) {
  const blocked = requireApiKey(c)
  if (blocked) return blocked

  const auth = await requireBearerUser(c)
  if (auth.error) return auth.error

  const body = await c.req.json().catch(() => ({}))
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const currentPassword =
    typeof body?.currentPassword === 'string' ? body.currentPassword : ''
  if (!email || !currentPassword) {
    return json(c, 400, { error: 'Informe e-mail e senha atual.' })
  }

  const user = await getAdminAuth().getUser(auth.decoded.uid)
  if (!user.email) {
    return json(c, 400, { error: 'Conta sem e-mail/senha. Use login com Google.' })
  }

  try {
    await verifyPassword(user.email, currentPassword)
    await getAdminAuth().updateUser(auth.decoded.uid, { email })
    const tenant = await updateTenant(auth.decoded.uid, { email })
    return json(c, 200, tenant ?? { ok: true })
  } catch (err) {
    return json(c, 400, { error: adminAuthErrorMessage(err) })
  }
}

export async function updateProfilePasswordHandler(c) {
  const blocked = requireApiKey(c)
  if (blocked) return blocked

  const auth = await requireBearerUser(c)
  if (auth.error) return auth.error

  const body = await c.req.json().catch(() => ({}))
  const currentPassword =
    typeof body?.currentPassword === 'string' ? body.currentPassword : ''
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''
  if (!currentPassword || newPassword.length < 6) {
    return json(c, 400, { error: 'Informe senha atual e nova senha (mín. 6 caracteres).' })
  }

  const user = await getAdminAuth().getUser(auth.decoded.uid)
  if (!user.email) {
    return json(c, 400, { error: 'Conta sem e-mail/senha. Use login com Google.' })
  }

  try {
    await verifyPassword(user.email, currentPassword)
    await getAdminAuth().updateUser(auth.decoded.uid, { password: newPassword })
    return json(c, 200, { ok: true })
  } catch (err) {
    return json(c, 400, { error: adminAuthErrorMessage(err) })
  }
}

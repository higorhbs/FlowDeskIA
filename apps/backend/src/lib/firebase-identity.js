import { identityErrorMessage } from './auth-errors.js'

const IDENTITY = 'https://identitytoolkit.googleapis.com/v1'

async function identityPost(path, apiKey, body) {
  const res = await fetch(`${IDENTITY}${path}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(identityErrorMessage(data))
    err.code = data?.error?.message
    throw err
  }
  return data
}

export function signUpWithPassword(apiKey, email, password) {
  return identityPost('/accounts:signUp', apiKey, {
    email,
    password,
    returnSecureToken: true,
  })
}

export function signInWithPassword(apiKey, email, password) {
  return identityPost('/accounts:signInWithPassword', apiKey, {
    email,
    password,
    returnSecureToken: true,
  })
}

export function sendVerifyEmailOob(apiKey, idToken, continueUrl) {
  const body = { requestType: 'VERIFY_EMAIL', idToken }
  if (continueUrl) body.continueUrl = continueUrl
  return identityPost('/accounts:sendOobCode', apiKey, body)
}

export function signInWithGoogleAccessToken(apiKey, accessToken, requestUri) {
  const postBody = `access_token=${encodeURIComponent(accessToken)}&providerId=google.com`
  return identityPost('/accounts:signInWithIdp', apiKey, {
    postBody,
    requestUri,
    returnSecureToken: true,
  })
}

const MAP = {
  EMAIL_EXISTS: 'E-mail já cadastrado.',
  EMAIL_NOT_FOUND: 'Usuário não encontrado.',
  INVALID_PASSWORD: 'Senha incorreta.',
  INVALID_EMAIL: 'E-mail inválido.',
  WEAK_PASSWORD: 'Senha muito fraca (mínimo 6 caracteres).',
  USER_DISABLED: 'Conta desativada.',
  OPERATION_NOT_ALLOWED: 'Método de login desativado no Firebase.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Muitas tentativas. Aguarde e tente de novo.',
  INVALID_IDP_RESPONSE: 'Credencial do Google inválida.',
  CREDENTIAL_TOO_OLD_LOGIN_AGAIN: 'Por segurança, entre de novo.',
}

export function identityErrorMessage(payload, fallback = 'Falha na autenticação') {
  const msg = payload?.error?.message ?? payload?.error?.errors?.[0]?.message
  if (!msg || typeof msg !== 'string') return fallback
  const key = msg.replace(/^ERROR_/, '').replace(/^auth\//, '').toUpperCase().replace(/-/g, '_')
  for (const [code, text] of Object.entries(MAP)) {
    if (msg.includes(code) || key === code) return text
  }
  return msg
}

export function adminAuthErrorMessage(err, fallback = 'Falha na autenticação') {
  const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : ''
  const map = {
    'auth/email-already-exists': MAP.EMAIL_EXISTS,
    'auth/user-not-found': MAP.EMAIL_NOT_FOUND,
    'auth/invalid-password': MAP.INVALID_PASSWORD,
    'auth/invalid-email': MAP.INVALID_EMAIL,
    'auth/weak-password': MAP.WEAK_PASSWORD,
  }
  return map[code] ?? (err instanceof Error ? err.message : fallback)
}

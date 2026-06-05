const SANDBOX_URL = 'https://sandbox.asaas.com/api/v3'
const PRODUCTION_URL = 'https://api.asaas.com/api/v3'

function optionalEnv(name) {
  const v = process.env[name]?.trim()
  return v || undefined
}

export function asaasBaseUrl(sandbox) {
  if (sandbox) return SANDBOX_URL
  return optionalEnv('ASAAS_BASE_URL') ?? PRODUCTION_URL
}

export function isPlatformAsaasConfigured() {
  return Boolean(optionalEnv('ASAAS_API_KEY'))
}

export function resolveAsaasCredentials(integration) {
  if (integration?.apiKey?.trim()) {
    return {
      apiKey: integration.apiKey.trim(),
      baseUrl: asaasBaseUrl(integration.sandbox === true),
    }
  }
  const platformKey = optionalEnv('ASAAS_API_KEY')
  if (!platformKey) return null
  const baseUrl = optionalEnv('ASAAS_BASE_URL') ?? PRODUCTION_URL
  return { apiKey: platformKey, baseUrl }
}

export function isAsaasConfigured(integration) {
  return resolveAsaasCredentials(integration) !== null
}

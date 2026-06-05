export function requireEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Variável de ambiente obrigatória: ${name}`)
  return value
}

export function optionalEnv(name) {
  const value = process.env[name]?.trim()
  return value || undefined
}

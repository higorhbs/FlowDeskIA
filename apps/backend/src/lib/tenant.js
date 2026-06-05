import { createTenant, getTenant } from '@flowdesk/firebase'

export async function ensureServerTenant(uid, { name, email }) {
  const existing = await getTenant(uid)
  if (existing) return existing
  const displayName = name?.trim() || email.split('@')[0] || 'Usuário'
  return createTenant(uid, { name: displayName, email })
}

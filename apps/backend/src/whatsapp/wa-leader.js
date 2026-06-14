import { getDb, nowIso } from '@flowdesk/firebase'
import { log } from '../lib/log.js'

const LEASE_MS = 45_000
const RENEW_MS = 15_000

function leaderRef() {
  return getDb().doc('system/waSocketLeader')
}

function instanceId() {
  return (
    process.env.WA_INSTANCE_ID?.trim() ||
    process.env.HOSTNAME?.trim() ||
    `pid-${process.pid}`
  )
}

export async function acquireWaLeadership() {
  if (process.env.WA_LEADER_DISABLED === 'true') return true
  const id = instanceId()
  const now = Date.now()
  try {
    const ok = await getDb().runTransaction(async (tx) => {
      const snap = await tx.get(leaderRef())
      const data = snap.data()
      const expires = data?.expiresAt ? Date.parse(String(data.expiresAt)) : 0
      if (!data || expires < now || data.instanceId === id) {
        tx.set(leaderRef(), {
          instanceId: id,
          expiresAt: new Date(now + LEASE_MS).toISOString(),
          updatedAt: nowIso(),
        })
        return true
      }
      return false
    })
    if (!ok) {
      const snap = await leaderRef().get().catch(() => null)
      const holder = snap?.data()
      log.warn(
        `[whatsapp] socket leader held by another instance; workers skipped on ${id}` +
          (holder?.instanceId
            ? ` (holder=${holder.instanceId} expires=${holder.expiresAt ?? '?'})`
            : '')
      )
    } else {
      log.info(`[whatsapp] socket leader acquired (${id})`)
    }
    return ok
  } catch (err) {
    log.error('[whatsapp] leader acquire failed, running workers anyway:', err)
    return true
  }
}

export function startWaLeadershipRenewal() {
  const id = instanceId()
  setInterval(() => {
    void getDb()
      .runTransaction(async (tx) => {
        const snap = await tx.get(leaderRef())
        if (snap.data()?.instanceId !== id) return
        tx.update(leaderRef(), {
          expiresAt: new Date(Date.now() + LEASE_MS).toISOString(),
          updatedAt: nowIso(),
        })
      })
      .catch(() => undefined)
  }, RENEW_MS)
}

export async function releaseWaLeadership() {
  if (process.env.WA_LEADER_DISABLED === 'true') return
  const id = instanceId()
  try {
    await getDb().runTransaction(async (tx) => {
      const snap = await tx.get(leaderRef())
      if (snap.data()?.instanceId === id) tx.delete(leaderRef())
    })
    log.info(`[whatsapp] socket leader released (${id})`)
  } catch (err) {
    log.debug('[whatsapp] leader release failed:', err)
  }
}

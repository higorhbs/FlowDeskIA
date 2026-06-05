import {
  defaultBusinessSchedule,
  getBusiness,
  getBusinessSchedule,
  hasAdminCredential,
  listBusinessSchedules,
  upsertBusinessSchedule,
} from '@flowdesk/firebase'
import { json, requireBearerUser } from '../../lib/auth-guard.js'
import { parseScheduleBody } from '../../lib/schedule-parse.js'

function requireAdmin(c) {
  if (!hasAdminCredential()) {
    return json(c, 503, {
      error: 'Credencial Firebase Admin ausente.',
    })
  }
  return null
}

async function resolveBusiness(c, businessId) {
  const auth = await requireBearerUser(c)
  if (auth.error) return { error: auth.error }

  const business = await getBusiness(businessId, auth.decoded.uid)
  if (!business) {
    return { error: json(c, 404, { error: 'Negócio não encontrado.' }) }
  }
  return { auth, business }
}

export async function listSchedulesHandler(c) {
  const blocked = requireAdmin(c)
  if (blocked) return blocked

  const auth = await requireBearerUser(c)
  if (auth.error) return auth.error

  const businessId = c.req.query('businessId')?.trim()

  try {
    if (businessId) {
      const business = await getBusiness(businessId, auth.decoded.uid)
      if (!business) {
        return json(c, 404, { error: 'Negócio não encontrado.' })
      }
      const schedule =
        (await getBusinessSchedule(businessId, auth.decoded.uid)) ??
        defaultBusinessSchedule(businessId, auth.decoded.uid)
      return json(c, 200, { schedules: [schedule] })
    }

    const schedules = await listBusinessSchedules(auth.decoded.uid)
    return json(c, 200, {
      schedules: schedules.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    })
  } catch (err) {
    return json(c, 500, {
      error: err instanceof Error ? err.message : 'Erro ao listar horários.',
    })
  }
}

export async function putScheduleHandler(c) {
  const blocked = requireAdmin(c)
  if (blocked) return blocked

  const businessId = c.req.param('businessId')
  const ctx = await resolveBusiness(c, businessId)
  if (ctx.error) return ctx.error

  const parsed = parseScheduleBody(await c.req.json().catch(() => ({})), { partial: false })
  if (parsed.error) return json(c, 400, { error: parsed.error })

  const lunchBreak = parsed.data.lunchBreak
  const lunchMsg = parsed.data.lunchMsg
  if (lunchBreak && lunchMsg && lunchMsg.length < 5) {
    return json(c, 400, { error: 'lunchMsg precisa ter pelo menos 5 caracteres.' })
  }

  try {
    const schedule = await upsertBusinessSchedule(
      businessId,
      ctx.auth.decoded.uid,
      parsed.data
    )
    return json(c, 200, schedule)
  } catch (err) {
    return json(c, 500, {
      error: err instanceof Error ? err.message : 'Erro ao salvar horários.',
    })
  }
}

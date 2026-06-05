import {
  cancelScheduledStatus,
  cancelScheduledStatusSeries,
  createScheduledStatus,
  expandRecurrenceToDayKeys,
  getBusiness,
  hasAdminCredential,
  listScheduledStatuses,
  repostScheduledStatus,
} from '@flowdesk/firebase'
import { json, requireBearerUser } from '../../../lib/auth-guard.js'
import { saveStatusMedia } from '../../../whatsapp/status-media.js'
import { isWhatsAppRuntime } from '../../../whatsapp/wa-manager.js'

function requireAdmin(c) {
  if (!hasAdminCredential()) {
    return json(c, 503, { error: 'Credencial Firebase Admin ausente.' })
  }
  return null
}

async function resolveOwnedBusiness(c, businessId) {
  const auth = await requireBearerUser(c)
  if (auth.error) return { error: auth.error }

  const business = await getBusiness(businessId, auth.decoded.uid)
  if (!business) {
    return { error: json(c, 404, { error: 'Negócio não encontrado.' }) }
  }
  return { auth, business }
}

async function readUploadFile(file) {
  if (!file || typeof file.arrayBuffer !== 'function') return null
  const buf = Buffer.from(await file.arrayBuffer())
  const mimetype = file.type || 'application/octet-stream'
  return { buffer: buf, mimetype }
}

function parseScheduledDays(raw) {
  if (Array.isArray(raw)) {
    return raw.map((d) => String(d).trim()).filter(Boolean)
  }
  if (typeof raw !== 'string' || !raw.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.map((d) => String(d).trim()).filter(Boolean)
    }
  } catch {
    /* fall through */
  }
  return raw.split(',').map((d) => d.trim()).filter(Boolean)
}

function parseRecurrenceWeekdays(raw) {
  if (Array.isArray(raw)) {
    return raw.map(Number).filter((n) => Number.isInteger(n))
  }
  if (typeof raw !== 'string' || !raw.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.map(Number).filter((n) => Number.isInteger(n))
    }
  } catch {
    return raw.split(',').map(Number).filter((n) => Number.isInteger(n))
  }
  return []
}

function resolveScheduledDays(fields) {
  const mode = fields.recurrenceMode ?? 'none'
  if (mode === 'none' || !mode) {
    return parseScheduledDays(fields.scheduledDays)
  }
  return expandRecurrenceToDayKeys({
    recurrenceMode: mode,
    scheduledDays: parseScheduledDays(fields.scheduledDays),
    recurrenceStartDayKey:
      typeof fields.recurrenceStartDayKey === 'string'
        ? fields.recurrenceStartDayKey.trim()
        : undefined,
    recurrenceIntervalDays: Number(fields.recurrenceIntervalDays),
    recurrenceWeekdays: parseRecurrenceWeekdays(fields.recurrenceWeekdays),
  })
}

function parsePublishNow(raw) {
  return raw === true || raw === 'true' || raw === '1' || raw === 1
}

function parseScheduleFields(fields) {
  const publishNow = parsePublishNow(fields.publishNow)
  let scheduledDays = []
  if (!publishNow) {
    try {
      scheduledDays = resolveScheduledDays(fields)
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Agendamento inválido.' }
    }
  }
  const hour = Number(fields.hour)
  const minute = Number(fields.minute)
  const caption =
    typeof fields.caption === 'string' && fields.caption.trim()
      ? fields.caption.trim().slice(0, 700)
      : undefined

  if (publishNow) {
    return { publishNow: true, scheduledDays: [], hour: 0, minute: 0, caption }
  }

  if (scheduledDays.length === 0) return { error: 'scheduledDays é obrigatório.' }
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return { error: 'hour inválido (0–23).' }
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    return { error: 'minute inválido (0–59).' }
  }

  return { scheduledDays, hour, minute, caption }
}

function parseCreateBody(body) {
  const mediaUrl = typeof body?.mediaUrl === 'string' ? body.mediaUrl.trim() : ''
  const mediaStoragePath =
    typeof body?.mediaStoragePath === 'string' ? body.mediaStoragePath.trim() : undefined
  const mediaType = body?.mediaType === 'video' ? 'video' : body?.mediaType === 'image' ? 'image' : null
  const schedule = parseScheduleFields(body)
  if (schedule.error) return schedule
  if (!mediaUrl) return { error: 'mediaUrl é obrigatório.' }
  if (!mediaType) return { error: 'mediaType deve ser image ou video.' }

  return { ...schedule, mediaUrl, mediaStoragePath, mediaType }
}

function parseRepostBody(body) {
  const publishNow = parsePublishNow(body?.publishNow)
  let scheduledDays = []
  if (!publishNow) {
    try {
      scheduledDays = resolveScheduledDays(body ?? {})
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Agendamento inválido.' }
    }
  }
  const hour = Number(body?.hour)
  const minute = Number(body?.minute)

  if (publishNow) {
    return { publishNow: true, scheduledDays: [], hour: 0, minute: 0 }
  }

  if (scheduledDays.length === 0) return { error: 'scheduledDays é obrigatório.' }
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return { error: 'hour inválido (0–23).' }
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    return { error: 'minute inválido (0–59).' }
  }

  return { publishNow: false, scheduledDays, hour, minute }
}

function handleStoryError(c, err) {
  const msg = err instanceof Error ? err.message : 'Erro ao processar stories.'
  const status =
    msg.includes('não encontrado') ||
    msg.includes('não encontrada') ||
    msg.includes('sem acesso')
      ? 404
      : msg.includes('plano') || msg.includes('limite') || msg.includes('máximo')
        ? 403
        : 400
  return json(c, status, { error: msg })
}

export async function listStoriesHandler(c) {
  const blocked = requireAdmin(c)
  if (blocked) return blocked

  const businessId = c.req.param('businessId')
  const ctx = await resolveOwnedBusiness(c, businessId)
  if (ctx.error) return ctx.error

  const items = await listScheduledStatuses(businessId)
  return json(c, 200, items)
}

export async function postStoriesHandler(c) {
  const blocked = requireAdmin(c)
  if (blocked) return blocked

  const businessId = c.req.param('businessId')
  const ctx = await resolveOwnedBusiness(c, businessId)
  if (ctx.error) return ctx.error

  const contentType = c.req.header('content-type') ?? ''
  let parsed

  if (contentType.includes('multipart/form-data')) {
    if (!isWhatsAppRuntime()) {
      return json(c, 503, {
        error: 'WhatsApp indisponível (ENABLE_WORKERS=true).',
      })
    }

    const form = await c.req.parseBody()
    const schedule = parseScheduleFields(form)
    if (schedule.error) return json(c, 400, { error: schedule.error })

    const upload = await readUploadFile(form.file)
    if (!upload?.buffer?.length) {
      return json(c, 400, { error: 'Arquivo obrigatório.' })
    }

    try {
      const saved = await saveStatusMedia(businessId, upload.buffer, upload.mimetype)
      parsed = {
        ...schedule,
        mediaUrl: saved.mediaUrl,
        mediaStoragePath: saved.mediaStoragePath,
        mediaType: saved.mediaType,
      }
    } catch (err) {
      return json(c, 400, {
        error: err instanceof Error ? err.message : 'Upload inválido',
      })
    }
  } else {
    const body = await c.req.json().catch(() => ({}))
    parsed = parseCreateBody(body)
    if (parsed.error) return json(c, 400, { error: parsed.error })
  }

  try {
    const rows = await createScheduledStatus(businessId, ctx.business.tenantId, parsed)
    if (parsed.publishNow && rows.length && isWhatsAppRuntime()) {
      const { enqueueImmediateStatusPublish } = await import(
        '../../../../dist/whatsapp/workers/status-scheduler.js'
      )
      for (const row of rows) {
        enqueueImmediateStatusPublish({ businessId, id: row.id })
      }
    }
    return json(c, 200, rows)
  } catch (err) {
    return handleStoryError(c, err)
  }
}

export async function postStoryRepostHandler(c) {
  const blocked = requireAdmin(c)
  if (blocked) return blocked

  const businessId = c.req.param('businessId')
  const statusId = c.req.param('statusId')
  const ctx = await resolveOwnedBusiness(c, businessId)
  if (ctx.error) return ctx.error

  const body = await c.req.json().catch(() => ({}))
  const parsed = parseRepostBody(body)
  if (parsed.error) return json(c, 400, { error: parsed.error })

  try {
    const rows = await repostScheduledStatus(
      businessId,
      ctx.business.tenantId,
      statusId,
      parsed
    )
    if (parsed.publishNow && rows.length && isWhatsAppRuntime()) {
      const { enqueueImmediateStatusPublish } = await import(
        '../../../../dist/whatsapp/workers/status-scheduler.js'
      )
      for (const row of rows) {
        enqueueImmediateStatusPublish({ businessId, id: row.id })
      }
    }
    return json(c, 200, rows)
  } catch (err) {
    return handleStoryError(c, err)
  }
}

export async function deleteStoryHandler(c) {
  const blocked = requireAdmin(c)
  if (blocked) return blocked

  const businessId = c.req.param('businessId')
  const statusId = c.req.param('statusId')
  const ctx = await resolveOwnedBusiness(c, businessId)
  if (ctx.error) return ctx.error

  try {
    await cancelScheduledStatus(businessId, statusId)
    return json(c, 200, { ok: true })
  } catch (err) {
    return handleStoryError(c, err)
  }
}

export async function deleteStorySeriesHandler(c) {
  const blocked = requireAdmin(c)
  if (blocked) return blocked

  const businessId = c.req.param('businessId')
  const seriesId = c.req.param('seriesId')
  const ctx = await resolveOwnedBusiness(c, businessId)
  if (ctx.error) return ctx.error

  try {
    await cancelScheduledStatusSeries(businessId, seriesId)
    return json(c, 200, { ok: true })
  } catch (err) {
    return handleStoryError(c, err)
  }
}

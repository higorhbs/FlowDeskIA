import {
  getBusinessWithRelations,
  listAppointments,
  listBusinessesWithDailyReport,
  localScheduleToUtc,
  releaseDailyReport,
  setBusinessConnected,
  tryClaimDailyReport,
} from '@flowdesk/firebase'
import { DEFAULT_BUSINESS_TIMEZONE, getLocalDateKey, getLocalTimeParts } from '@flowdesk/shared'
import { log } from '../../lib/log.js'
import { buildReportPdf } from '../../lib/report-pdf.js'
import { resolveWhatsAppClient } from '../wa-lifecycle.runtime.js'

const TICK_MS = 60_000
const FIRST_TICK_DELAY_MS = 30_000
const WINDOW_MIN = 10

function dayRange(dateKey, tz) {
  const from = localScheduleToUtc(dateKey, 0, 0, tz)
  const to = localScheduleToUtc(dateKey, 23, 59, tz)
  to.setSeconds(59, 999)
  return { from: from.toISOString(), to: to.toISOString() }
}

async function sendReportFor(business) {
  const tz = business.timezone || DEFAULT_BUSINESS_TIMEZONE
  const targetTotal = (business.dailyReportHour ?? 0) * 60 + (business.dailyReportMinute ?? 0)
  const { hours, minutes } = getLocalTimeParts(tz)
  const nowTotal = hours * 60 + minutes
  if (nowTotal < targetTotal || nowTotal > targetTotal + WINDOW_MIN) return

  const dateKey = getLocalDateKey(tz)
  if (!(await tryClaimDailyReport(business.id, dateKey))) return

  try {
    const client = await resolveWhatsAppClient(business.id, { waitMs: 12_000 })
    if (!client) {
      await setBusinessConnected(business.id, false)
      await releaseDailyReport(business.id, dateKey)
      return
    }

    const full = (await getBusinessWithRelations(business.id)) ?? business
    const { from, to } = dayRange(dateKey, tz)
    const appointments = await listAppointments(business.id, { from, to })
    const priceById = new Map()
    const priceByName = new Map()
    for (const item of full.catalog ?? []) {
      priceById.set(item.id, item.price ?? 0)
      priceByName.set(item.name, item.price ?? 0)
    }

    const pdf = await buildReportPdf({
      period: 'day',
      business: full,
      appointments,
      priceById,
      priceByName,
      from,
      to,
    })
    const filename = `relatorio-day-${dateKey}.pdf`
    const caption = `Relatório do dia — ${full.name}`
    await client.sendDocument(full.phone, pdf, filename, 'application/pdf', caption, { self: true })
    log.info(`[daily-report] sent business=${business.id} count=${appointments.length}`)
  } catch (err) {
    await releaseDailyReport(business.id, dateKey)
    log.error(`[daily-report] failed business=${business.id}:`, err)
  }
}

export function startDailyReportWorker() {
  let running = false
  const run = async () => {
    if (running) return
    running = true
    try {
      const list = await listBusinessesWithDailyReport()
      for (const business of list) {
        await sendReportFor(business)
      }
    } catch (err) {
      log.error('[daily-report] tick error:', err)
    } finally {
      running = false
    }
  }
  setTimeout(() => void run().catch(() => undefined), FIRST_TICK_DELAY_MS)
  setInterval(() => void run().catch(() => undefined), TICK_MS)
  log.info('[daily-report] started')
}

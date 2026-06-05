const DAY_KEYS = new Set(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export function defaultWorkingHours() {
  const h = {}
  for (const d of DAY_KEYS) {
    h[d] = d === 'sun' ? null : ['09:00', '18:00']
  }
  return h
}

function parseSlot(raw) {
  if (raw === null) return null
  if (
    Array.isArray(raw) &&
    raw.length === 2 &&
    typeof raw[0] === 'string' &&
    typeof raw[1] === 'string' &&
    TIME_RE.test(raw[0]) &&
    TIME_RE.test(raw[1])
  ) {
    return [raw[0], raw[1]]
  }
  return undefined
}

export function parseWorkingHours(raw) {
  if (!raw || typeof raw !== 'object') return { error: 'workingHours inválido.' }
  const out = {}
  for (const [day, slot] of Object.entries(raw)) {
    if (!DAY_KEYS.has(day)) return { error: `Dia inválido: ${day}` }
    const parsed = parseSlot(slot)
    if (parsed === undefined) return { error: `Horário inválido em ${day}.` }
    out[day] = parsed
  }
  for (const day of DAY_KEYS) {
    if (!(day in out)) out[day] = day === 'sun' ? null : ['09:00', '18:00']
  }
  return { data: out }
}

export function parseSpecialHours(raw) {
  if (!raw || typeof raw !== 'object') return { error: 'specialHours inválido.' }
  const out = {}
  for (const [date, slot] of Object.entries(raw)) {
    if (!DATE_RE.test(date)) return { error: `Data inválida: ${date}` }
    const parsed = parseSlot(slot)
    if (parsed === undefined) return { error: `Horário inválido em ${date}.` }
    out[date] = parsed
  }
  return { data: out }
}

export function parseLunchBreak(raw) {
  if (raw === null) return { data: null }
  const parsed = parseSlot(raw)
  if (parsed === undefined) return { error: 'Horário de almoço inválido.' }
  return { data: parsed }
}

export function parseExceptionBody(body) {
  const date = typeof body?.date === 'string' ? body.date.trim() : ''
  if (!DATE_RE.test(date)) return { error: 'Informe date no formato YYYY-MM-DD.' }

  if (body?.closed === true || body?.slot === null) {
    return { data: { date, slot: null } }
  }

  const open = typeof body?.open === 'string' ? body.open : body?.slot?.[0]
  const close = typeof body?.close === 'string' ? body.close : body?.slot?.[1]
  if (typeof open === 'string' && typeof close === 'string') {
    const slot = parseSlot([open, close])
    if (slot === undefined) return { error: 'Horário de abertura/fechamento inválido.' }
    return { data: { date, slot } }
  }

  return { error: 'Informe open/close, slot ou closed: true.' }
}

export function parseScheduleBody(body, { partial = false } = {}) {
  const patch = {}
  if (body?.timezone !== undefined) {
    const tz = typeof body.timezone === 'string' ? body.timezone.trim() : ''
    if (!tz) return { error: 'timezone inválido.' }
    patch.timezone = tz
  }
  if (body?.workingHours !== undefined) {
    const wh = parseWorkingHours(body.workingHours)
    if (wh.error) return wh
    patch.workingHours = wh.data
  }
  if (body?.specialHours !== undefined) {
    const sh = parseSpecialHours(body.specialHours)
    if (sh.error) return sh
    patch.specialHours = sh.data
  }
  if (body?.lunchBreak !== undefined) {
    const lb = parseLunchBreak(body.lunchBreak)
    if (lb.error) return lb
    patch.lunchBreak = lb.data
  }
  if (body?.lunchMsg !== undefined) {
    const msg = typeof body.lunchMsg === 'string' ? body.lunchMsg.trim() : ''
    if (body.lunchBreak !== null && patch.lunchBreak !== null && msg.length < 5) {
      return { error: 'lunchMsg precisa ter pelo menos 5 caracteres.' }
    }
    patch.lunchMsg = msg || undefined
  }
  if (!partial && !patch.workingHours) {
    patch.workingHours = defaultWorkingHours()
  }
  if (Object.keys(patch).length === 0 && partial) {
    return { error: 'Nenhum campo para atualizar.' }
  }
  return { data: patch }
}

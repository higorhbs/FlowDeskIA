const MIN_LEAD_MS = 60_000;
export const IMMEDIATE_LEAD_MS = 0;
export const MAX_SCHEDULE_DAYS = 62;

export type RecurrenceMode = "none" | "interval" | "weekdays";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function dateDayKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDayKey(key: string): Date {
  const [y, m, day] = key.split("-").map(Number);
  return new Date(y!, m! - 1, day!);
}

export function buildScheduledAtsFromDayKeys(
  dayKeys: string[],
  hour: number,
  minute: number,
  minLeadMs = MIN_LEAD_MS
): string[] {
  const unique = [...new Set(dayKeys)].sort();
  if (unique.length === 0) throw new Error("Selecione pelo menos um dia no calendário.");
  if (unique.length > MAX_SCHEDULE_DAYS) {
    throw new Error(`Selecione no máximo ${MAX_SCHEDULE_DAYS} dias por vez.`);
  }

  const minAt = Date.now() + minLeadMs;
  const out: string[] = [];

  for (const key of unique) {
    const parts = key.split("-").map(Number);
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) continue;
    const [y, m, d] = parts;
    const dt = new Date(y!, m! - 1, d!, hour, minute, 0, 0);
    if (dt.getTime() >= minAt) out.push(dt.toISOString());
  }

  if (out.length === 0) {
    throw new Error("Nenhum dia válido: escolha datas futuras e um horário pelo menos 1 min à frente.");
  }

  return out;
}

export function buildImmediateScheduledAt(leadMs = IMMEDIATE_LEAD_MS): string {
  return new Date(Date.now() + leadMs).toISOString();
}

export function resolveStoryScheduledAts(input: {
  publishNow?: boolean;
  scheduledDays: string[];
  hour: number;
  minute: number;
}): string[] {
  if (input.publishNow) return [buildImmediateScheduledAt()];
  return buildScheduledAtsFromDayKeys(input.scheduledDays, input.hour, input.minute);
}

export function addDaysToDayKey(dayKey: string, days: number): string {
  const d = parseDayKey(dayKey);
  d.setDate(d.getDate() + days);
  return dateDayKey(d);
}

export function buildRecurringDayKeysByInterval(
  startDayKey: string,
  everyDays: number,
  maxCount = MAX_SCHEDULE_DAYS
): string[] {
  if (!Number.isFinite(everyDays) || everyDays <= 0) {
    throw new Error("Recorrência inválida: intervalo precisa ser maior que zero.");
  }
  const out: string[] = [];
  for (let i = 0; i < maxCount; i++) {
    out.push(addDaysToDayKey(startDayKey, i * everyDays));
  }
  return out;
}

export function buildRecurringDayKeysByWeekdays(
  weekdayNumbers: number[],
  startDayKey: string,
  maxCount = MAX_SCHEDULE_DAYS
): string[] {
  const weekdays = [...new Set(weekdayNumbers)]
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    .sort((a, b) => a - b);
  if (weekdays.length === 0) {
    throw new Error("Selecione pelo menos um dia da semana.");
  }
  const start = parseDayKey(startDayKey);
  start.setHours(0, 0, 0, 0);
  const out: string[] = [];
  const cursor = new Date(start);
  let guard = 0;
  while (out.length < maxCount && guard < 730) {
    if (weekdays.includes(cursor.getDay())) out.push(dateDayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
    guard++;
  }
  return out;
}

export function expandRecurrenceToDayKeys(input: {
  recurrenceMode?: RecurrenceMode | string;
  scheduledDays?: string[];
  recurrenceStartDayKey?: string;
  recurrenceIntervalDays?: number;
  recurrenceWeekdays?: number[];
}): string[] {
  const mode = (input.recurrenceMode ?? "none") as RecurrenceMode;
  if (mode === "none") return input.scheduledDays ?? [];
  const start = input.recurrenceStartDayKey?.trim();
  if (!start) throw new Error("recurrenceStartDayKey é obrigatório para recorrência.");
  if (mode === "interval") {
    const every = Number(input.recurrenceIntervalDays);
    if (![1, 2, 7, 15].includes(every)) {
      throw new Error("recurrenceIntervalDays inválido (1, 2, 7 ou 15).");
    }
    return buildRecurringDayKeysByInterval(start, every);
  }
  if (mode === "weekdays") {
    return buildRecurringDayKeysByWeekdays(input.recurrenceWeekdays ?? [], start);
  }
  throw new Error("recurrenceMode inválido.");
}

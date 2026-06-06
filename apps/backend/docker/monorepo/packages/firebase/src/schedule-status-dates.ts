const MIN_LEAD_MS = 60_000;
export const IMMEDIATE_LEAD_MS = 0;
export const MAX_SCHEDULE_DAYS = 62;
export const DEFAULT_SCHEDULE_TZ = "America/Sao_Paulo";

export type RecurrenceMode = "none" | "interval" | "weekdays";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function timezoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = dtf.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return asUtc - date.getTime();
}

export function localScheduleToUtc(
  dayKey: string,
  hour: number,
  minute: number,
  timeZone = DEFAULT_SCHEDULE_TZ
): Date {
  const parts = dayKey.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error("dayKey inválido.");
  }
  const [y, mo, d] = parts;
  let utc = Date.UTC(y!, mo! - 1, d!, hour, minute, 0);
  for (let i = 0; i < 4; i++) {
    utc = Date.UTC(y!, mo! - 1, d!, hour, minute, 0) - timezoneOffsetMs(new Date(utc), timeZone);
  }
  return new Date(utc);
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
  minLeadMs = MIN_LEAD_MS,
  timeZone = DEFAULT_SCHEDULE_TZ
): string[] {
  const unique = [...new Set(dayKeys)].sort();
  if (unique.length === 0) throw new Error("Selecione pelo menos um dia no calendário.");
  if (unique.length > MAX_SCHEDULE_DAYS) {
    throw new Error(`Selecione no máximo ${MAX_SCHEDULE_DAYS} dias por vez.`);
  }

  const minAt = Date.now() + minLeadMs;
  const out: string[] = [];

  for (const key of unique) {
    let dt: Date;
    try {
      dt = localScheduleToUtc(key, hour, minute, timeZone);
    } catch {
      continue;
    }
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
  timezone?: string;
}): string[] {
  if (input.publishNow) return [buildImmediateScheduledAt()];
  return buildScheduledAtsFromDayKeys(
    input.scheduledDays,
    input.hour,
    input.minute,
    MIN_LEAD_MS,
    input.timezone?.trim() || DEFAULT_SCHEDULE_TZ
  );
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

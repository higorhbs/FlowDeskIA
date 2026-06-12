import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { dateDayKey, parseDayKey } from "@flowdesk/firebase/client";

export function isScheduledStatusHistoryEntry(item: {
  status: string;
  publishedAt?: string;
}): boolean {
  if (item.status === "published" || item.status === "failed") return true;
  if (item.status === "cancelled" && item.publishedAt) return true;
  return false;
}

export const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
] as const;

export type DayGroup<T> = {
  dayKey: string;
  dayLabel: string;
  items: T[];
};

export type WeekdayGroup<T> = {
  weekday: number;
  weekdayLabel: string;
  days: DayGroup<T>[];
  total: number;
  earliestDayKey: string;
};

function weekdayFromDayKey(dayKey: string): number {
  return parseDayKey(dayKey).getDay();
}

export type MonthGroup<T> = {
  monthKey: string;
  monthLabel: string;
  days: DayGroup<T>[];
  total: number;
};

function monthKeyFromDate(d: Date): string {
  return format(d, "yyyy-MM");
}

function monthLabelFromKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y!, m! - 1, 1);
  return format(d, "MMMM yyyy", { locale: ptBR });
}

function historyDayLabel(dayKey: string): string {
  return format(parseDayKey(dayKey), "dd/MM · EEEE", { locale: ptBR });
}

export function groupByMonthDayScheduled<T extends { scheduledAt: string }>(
  items: T[],
  order: "asc" | "desc" = "desc",
): MonthGroup<T>[] {
  const monthMap = new Map<string, Map<string, T[]>>();
  for (const item of items) {
    const d = new Date(item.scheduledAt);
    const monthKey = monthKeyFromDate(d);
    const dayKey = dateDayKey(d);
    if (!monthMap.has(monthKey)) monthMap.set(monthKey, new Map());
    const days = monthMap.get(monthKey)!;
    if (!days.has(dayKey)) days.set(dayKey, []);
    days.get(dayKey)!.push(item);
  }

  const daySort = order === "asc"
    ? (a: string, b: string) => a.localeCompare(b)
    : (a: string, b: string) => b.localeCompare(a);
  const itemSort = order === "asc"
    ? (a: T, b: T) => a.scheduledAt.localeCompare(b.scheduledAt)
    : (a: T, b: T) => b.scheduledAt.localeCompare(a.scheduledAt);
  const monthSort = order === "asc"
    ? (a: MonthGroup<T>, b: MonthGroup<T>) => a.monthKey.localeCompare(b.monthKey)
    : (a: MonthGroup<T>, b: MonthGroup<T>) => b.monthKey.localeCompare(a.monthKey);

  const groups: MonthGroup<T>[] = [];
  for (const [monthKey, dayMap] of monthMap) {
    const days = [...dayMap.entries()]
      .sort(([a], [b]) => daySort(a, b))
      .map(([dayKey, raw]) => ({
        dayKey,
        dayLabel: historyDayLabel(dayKey),
        items: [...raw].sort(itemSort),
      }));
    groups.push({
      monthKey,
      monthLabel: monthLabelFromKey(monthKey),
      days,
      total: days.reduce((n, d) => n + d.items.length, 0),
    });
  }
  return groups.sort(monthSort);
}

function dayLabel(dayKey: string): string {
  return format(parseDayKey(dayKey), "dd/MM/yyyy (EEEE)", { locale: ptBR });
}

export function groupByWeekdayDayKeys(dayKeys: string[]): WeekdayGroup<string>[] {
  const map = new Map<number, Map<string, string[]>>();
  for (const key of dayKeys) {
    const wd = weekdayFromDayKey(key);
    if (!map.has(wd)) map.set(wd, new Map());
    const days = map.get(wd)!;
    if (!days.has(key)) days.set(key, []);
    days.get(key)!.push(key);
  }
  return buildWeekdayGroups(map, (items) => items);
}

export function groupByWeekdayScheduled<T extends { scheduledAt: string }>(
  items: T[],
): WeekdayGroup<T>[] {
  const map = new Map<number, Map<string, T[]>>();
  for (const item of items) {
    const d = new Date(item.scheduledAt);
    const wd = d.getDay();
    const key = dateDayKey(d);
    if (!map.has(wd)) map.set(wd, new Map());
    const days = map.get(wd)!;
    if (!days.has(key)) days.set(key, []);
    days.get(key)!.push(item);
  }
  return buildWeekdayGroups(map, (itemsInDay) =>
    [...itemsInDay].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
  );
}

function buildWeekdayGroups<T>(
  map: Map<number, Map<string, T[]>>,
  sortItems: (items: T[]) => T[],
): WeekdayGroup<T>[] {
  const groups: WeekdayGroup<T>[] = [];
  for (const [weekday, dayMap] of map) {
    const days = [...dayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dayKey, raw]) => ({
        dayKey,
        dayLabel: dayLabel(dayKey),
        items: sortItems(raw),
      }));
    groups.push({
      weekday,
      weekdayLabel: WEEKDAY_LABELS[weekday] ?? `Dia ${weekday}`,
      days,
      total: days.reduce((n, d) => n + d.items.length, 0),
      earliestDayKey: days[0]?.dayKey ?? "",
    });
  }
  return groups.sort((a, b) => a.earliestDayKey.localeCompare(b.earliestDayKey));
}

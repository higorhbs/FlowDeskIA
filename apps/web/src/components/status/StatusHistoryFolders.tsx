"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronDown } from "lucide-react";
import { parseDayKey } from "@flowdesk/firebase/client";
import { cn } from "@/lib/utils";
import type { MonthGroup } from "./status-day-groups";

type Props<T> = {
  groups: MonthGroup<T>[];
  renderDay: (dayKey: string, items: T[]) => ReactNode;
  className?: string;
  openFirstDay?: boolean;
};

export function StatusHistoryFolders<T>({ groups, renderDay, className, openFirstDay }: Props<T>) {
  const firstDayKey = groups[0]?.days[0]?.dayKey ?? null;
  const [selectedDay, setSelectedDay] = useState<string | null>(
    openFirstDay ? firstDayKey : null,
  );

  const allDayKeys = useMemo(
    () => groups.flatMap((g) => g.days.map((d) => d.dayKey)),
    [groups],
  );

  useEffect(() => {
    if (selectedDay && !allDayKeys.includes(selectedDay)) {
      setSelectedDay(allDayKeys[0] ?? null);
    }
  }, [allDayKeys, selectedDay]);

  if (groups.length === 0) return null;

  const totalItems = groups.reduce((n, g) => n + g.total, 0);

  return (
    <div className={cn("space-y-7", className)}>
      {/* Summary */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 tabular-nums">
          {totalItems} {totalItems === 1 ? "story" : "stories"}
        </span>
        <span className="text-gray-200">·</span>
        <span className="text-xs text-gray-400 tabular-nums">
          {allDayKeys.length} {allDayKeys.length === 1 ? "dia" : "dias"}
        </span>
      </div>

      {groups.map((month) => {
        const selectedInMonth = month.days.find((d) => d.dayKey === selectedDay);

        return (
          <div key={month.monthKey}>
            {/* Month header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-5 rounded-full bg-gradient-to-b from-brand-400 to-brand-600 shrink-0" />
              <span className="text-sm font-bold text-gray-700 capitalize tracking-tight">
                {month.monthLabel}
              </span>
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[10px] font-semibold text-gray-500 tabular-nums bg-gray-100 px-2 py-0.5 rounded-full">
                {month.total} {month.total === 1 ? "story" : "stories"}
              </span>
            </div>

            {/* Date chips — horizontal scroll */}
            <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-0.5 px-0.5">
              {month.days.map((day) => {
                const date = parseDayKey(day.dayKey);
                const isSelected = selectedDay === day.dayKey;

                return (
                  <button
                    key={day.dayKey}
                    type="button"
                    onClick={() => setSelectedDay(isSelected ? null : day.dayKey)}
                    className={cn(
                      "group flex-shrink-0 flex flex-col items-center w-[58px] pt-3 pb-2.5 rounded-2xl transition-all duration-200 select-none",
                      isSelected
                        ? "bg-gradient-to-b from-brand-500 to-brand-700 shadow-xl shadow-brand-400/30 scale-[1.08] -translate-y-0.5"
                        : "bg-white border border-gray-200/80 shadow-sm hover:border-brand-200 hover:shadow-md hover:scale-[1.04] hover:-translate-y-0.5",
                    )}
                  >
                    {/* Weekday abbrev */}
                    <span
                      className={cn(
                        "text-[9px] font-bold uppercase tracking-widest leading-none",
                        isSelected ? "text-white/60" : "text-gray-400",
                      )}
                    >
                      {format(date, "EEE", { locale: ptBR })}
                    </span>

                    {/* Day number */}
                    <span
                      className={cn(
                        "text-2xl font-black leading-none mt-1",
                        isSelected ? "text-white" : "text-gray-800",
                      )}
                    >
                      {format(date, "dd")}
                    </span>

                    {/* Count badge */}
                    <span
                      className={cn(
                        "mt-1.5 text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded-full leading-none",
                        isSelected
                          ? "bg-white/25 text-white"
                          : "bg-brand-50 text-brand-600",
                      )}
                    >
                      {day.items.length}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Expanded content panel */}
            {selectedInMonth && (
              <div className="mt-4 rounded-2xl overflow-hidden shadow-md border border-gray-100/80">
                {/* Panel header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-brand-50 via-brand-50/60 to-white border-b border-brand-100/60">
                  <span className="text-xs font-semibold text-brand-800 capitalize">
                    {selectedInMonth.dayLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedDay(null)}
                    className="flex items-center gap-1 text-[11px] font-medium text-brand-600/70 hover:text-brand-700 transition-colors"
                  >
                    <ChevronDown className="w-3.5 h-3.5 rotate-180" />
                    Fechar
                  </button>
                </div>

                {/* Panel content */}
                <div className="bg-white">
                  {renderDay(selectedDay!, selectedInMonth.items)}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

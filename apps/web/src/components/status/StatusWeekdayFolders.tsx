"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { WeekdayGroup } from "./status-day-groups";

type Props<T> = {
  groups: WeekdayGroup<T>[];
  renderDay: (dayKey: string, items: T[]) => ReactNode;
  className?: string;
};

export function StatusWeekdayFolders<T>({ groups, renderDay, className }: Props<T>) {
  if (groups.length === 0) return null;

  return (
    <div className={cn("space-y-3", className)}>
      {groups.map((group) => (
        <div key={group.weekday}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold text-brand-600 uppercase tracking-widest whitespace-nowrap">
              {group.weekdayLabel}
            </span>
            <div className="flex-1 h-px bg-brand-100" />
            <span className="text-[10px] text-gray-400 tabular-nums shrink-0">
              {group.total}
            </span>
          </div>
          <div className="space-y-1 pl-1">
            {group.days.map((day) => (
              <div key={day.dayKey}>{renderDay(day.dayKey, day.items)}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

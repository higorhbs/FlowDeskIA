"use client";

import { useEffect } from "react";
import { CalendarDays, Repeat, Rows3 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  MAX_SCHEDULE_DAYS,
  buildRecurringDayKeysByInterval,
  buildRecurringDayKeysByWeekdays,
  dateDayKey,
} from "@flowdesk/firebase/client";

export type RecurrenceMode = "none" | "interval" | "weekdays";

type Props = {
  mode: RecurrenceMode;
  onModeChange: (mode: RecurrenceMode) => void;
  intervalDays: number;
  onIntervalDaysChange: (value: number) => void;
  weekdayNumbers: number[];
  onWeekdayNumbersChange: (value: number[]) => void;
  startDayKey: string;
  onStartDayKeyChange: (value: string) => void;
  onApplyGeneratedDays: (keys: string[]) => void;
};

const WEEKDAY_OPTIONS = [
  { value: 0, label: "D" },
  { value: 1, label: "S" },
  { value: 2, label: "T" },
  { value: 3, label: "Q" },
  { value: 4, label: "Q" },
  { value: 5, label: "S" },
  { value: 6, label: "S" },
] as const;

const INTERVAL_OPTIONS = [1, 2, 7, 15] as const;

const MODE_OPTIONS = [
  { value: "none" as const, label: "Única / manual", icon: CalendarDays },
  { value: "interval" as const, label: "A cada X dias", icon: Repeat },
  { value: "weekdays" as const, label: "Dias da semana", icon: Rows3 },
];

export function StatusRecurrenceControls({
  mode,
  onModeChange,
  intervalDays,
  onIntervalDaysChange,
  weekdayNumbers,
  onWeekdayNumbersChange,
  startDayKey,
  onStartDayKeyChange,
  onApplyGeneratedDays,
}: Props) {
  const todayKey = dateDayKey(new Date());

  function apply(modeToApply: RecurrenceMode) {
    if (modeToApply === "none") return;
    if (modeToApply === "interval") {
      onApplyGeneratedDays(
        buildRecurringDayKeysByInterval(startDayKey, intervalDays, MAX_SCHEDULE_DAYS),
      );
      return;
    }
    onApplyGeneratedDays(
      buildRecurringDayKeysByWeekdays(weekdayNumbers, startDayKey, MAX_SCHEDULE_DAYS),
    );
  }

  useEffect(() => {
    if (mode === "none") return;
    apply(mode);
  }, [mode, startDayKey, intervalDays, weekdayNumbers]);

  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50/40 p-4 space-y-3">
      <div>
        <Label className="text-sm">Recorrência</Label>
        <p className="text-xs text-gray-500 mt-0.5">
          Gera datas automaticamente, sempre dentro da janela de {MAX_SCHEDULE_DAYS} dias.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {MODE_OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              onModeChange(value);
              if (value === "none") onApplyGeneratedDays([startDayKey]);
              else apply(value);
            }}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-center transition-all duration-150",
              mode === value
                ? "bg-brand-600 border-brand-600 text-white shadow-sm"
                : "bg-white border-gray-200 text-gray-600 hover:border-brand-200 hover:bg-brand-50/40",
            )}
          >
            <Icon className={cn("w-4 h-4", mode === value ? "text-white" : "text-gray-400")} />
            <span className="text-[11px] font-semibold leading-tight">{label}</span>
          </button>
        ))}
      </div>

      {mode !== "none" && (
        <div className="space-y-3 pt-1">
          <div className="space-y-1">
            <Label htmlFor="recurrence-start-day" className="text-xs text-gray-600">
              Começar em
            </Label>
            <input
              id="recurrence-start-day"
              type="date"
              min={todayKey}
              value={startDayKey}
              onChange={(e) => onStartDayKeyChange(e.target.value)}
              className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"
            />
          </div>

          {mode === "interval" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">Repetir a cada</Label>
              <div className="flex flex-wrap gap-2">
                {INTERVAL_OPTIONS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      onIntervalDaysChange(value);
                      onApplyGeneratedDays(
                        buildRecurringDayKeysByInterval(startDayKey, value, MAX_SCHEDULE_DAYS),
                      );
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors",
                      intervalDays === value
                        ? "bg-brand-600 text-white border-brand-600"
                        : "bg-white text-gray-700 border-gray-200 hover:border-brand-200",
                    )}
                  >
                    {value} dia{value > 1 ? "s" : ""}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === "weekdays" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">Dias da semana</Label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_OPTIONS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => {
                      const exists = weekdayNumbers.includes(day.value);
                      const next = exists
                        ? weekdayNumbers.filter((d) => d !== day.value)
                        : [...weekdayNumbers, day.value].sort((a, b) => a - b);
                      onWeekdayNumbersChange(next);
                      if (next.length > 0) {
                        onApplyGeneratedDays(
                          buildRecurringDayKeysByWeekdays(next, startDayKey, MAX_SCHEDULE_DAYS),
                        );
                      }
                    }}
                    className={cn(
                      "w-9 h-9 rounded-full border text-xs font-bold transition-colors",
                      weekdayNumbers.includes(day.value)
                        ? "bg-brand-600 text-white border-brand-600"
                        : "bg-white text-gray-700 border-gray-200 hover:border-brand-200",
                    )}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => apply(mode)}
            className="h-10 w-full rounded-xl border border-brand-200 bg-brand-50 text-brand-700 text-sm font-semibold hover:bg-brand-100 transition-colors"
          >
            Regerar datas
          </button>
        </div>
      )}
    </div>
  );
}

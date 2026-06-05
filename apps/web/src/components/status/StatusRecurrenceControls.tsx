"use client";

import { useEffect } from "react";
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
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sab" },
] as const;

const INTERVAL_OPTIONS = [1, 2, 7, 15] as const;

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
    <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 space-y-3">
      <div className="space-y-1">
        <Label className="text-sm">Recorrência</Label>
        <p className="text-xs text-gray-500">Automaticamente gera até {MAX_SCHEDULE_DAYS} datas.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            onModeChange("none");
            onApplyGeneratedDays([startDayKey]);
          }}
          className={cn(
            "px-2.5 py-1.5 rounded-lg border text-xs font-medium",
            mode === "none"
              ? "bg-brand-600 text-white border-brand-600"
              : "bg-white text-gray-700 border-gray-200",
          )}
        >
          Única / manual
        </button>
        <button
          type="button"
          onClick={() => {
            onModeChange("interval");
            apply("interval");
          }}
          className={cn(
            "px-2.5 py-1.5 rounded-lg border text-xs font-medium",
            mode === "interval"
              ? "bg-brand-600 text-white border-brand-600"
              : "bg-white text-gray-700 border-gray-200",
          )}
        >
          A cada X dias
        </button>
        <button
          type="button"
          onClick={() => {
            onModeChange("weekdays");
            apply("weekdays");
          }}
          className={cn(
            "px-2.5 py-1.5 rounded-lg border text-xs font-medium",
            mode === "weekdays"
              ? "bg-brand-600 text-white border-brand-600"
              : "bg-white text-gray-700 border-gray-200",
          )}
        >
          Dias da semana
        </button>
      </div>

      {mode !== "none" && (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="recurrence-start-day" className="text-xs text-gray-600">
              Início
            </Label>
            <input
              id="recurrence-start-day"
              type="date"
              min={todayKey}
              value={startDayKey}
              onChange={(e) => {
                const next = e.target.value;
                onStartDayKeyChange(next);
              }}
              className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm"
            />
          </div>

          {mode === "interval" && (
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">Intervalo</Label>
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
                      "px-2.5 py-1.5 rounded-lg border text-xs font-medium",
                      intervalDays === value
                        ? "bg-brand-600 text-white border-brand-600"
                        : "bg-white text-gray-700 border-gray-200",
                    )}
                  >
                    {value} dia{value > 1 ? "s" : ""}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === "weekdays" && (
            <div className="space-y-1">
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
                      "px-2.5 py-1.5 rounded-lg border text-xs font-medium",
                      weekdayNumbers.includes(day.value)
                        ? "bg-brand-600 text-white border-brand-600"
                        : "bg-white text-gray-700 border-gray-200",
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
            className="h-9 w-full rounded-lg border border-brand-200 bg-brand-50 text-brand-700 text-sm font-medium"
          >
            Regerar datas
          </button>
        </div>
      )}
    </div>
  );
}

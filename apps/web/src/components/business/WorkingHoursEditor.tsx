"use client";

import { ChevronDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

const DAYS: Record<string, { short: string; weekday: boolean }> = {
  mon: { short: "Seg", weekday: true },
  tue: { short: "Ter", weekday: true },
  wed: { short: "Qua", weekday: true },
  thu: { short: "Qui", weekday: true },
  fri: { short: "Sex", weekday: true },
  sat: { short: "Sáb", weekday: false },
  sun: { short: "Dom", weekday: false },
};

const MINUTES = [0, 15, 30, 45];

export type WorkingHoursValue = Record<string, [string, string] | null>;

export function defaultWorkingHours(): WorkingHoursValue {
  const h: WorkingHoursValue = {};
  DAY_KEYS.forEach((d) => { h[d] = d === "sun" ? null : ["09:00", "18:00"]; });
  return h;
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent",
        "transition-colors duration-200 ease-in-out",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
        checked ? "bg-brand-600" : "bg-gray-200"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

// ── TimePicker ────────────────────────────────────────────────────────────────
function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parts = value.split(":");
  const hh = parseInt(parts[0] ?? "09", 10);
  const mm = parseInt(parts[1] ?? "00", 10);

  return (
    <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white overflow-hidden transition-all hover:border-brand-300 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500">
      {/* Hour */}
      <div className="relative flex items-center">
        <select
          value={hh}
          onChange={(e) =>
            onChange(`${Number(e.target.value).toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`)
          }
          className="appearance-none bg-transparent pl-3 pr-6 py-2 text-sm font-mono font-semibold text-gray-800 focus:outline-none cursor-pointer"
        >
          {Array.from({ length: 24 }, (_, i) => (
            <option key={i} value={i}>{i.toString().padStart(2, "0")}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-1 w-3 h-3 text-gray-400" />
      </div>

      <span className="text-gray-300 font-mono text-sm font-bold select-none -mx-1">:</span>

      {/* Minute */}
      <div className="relative flex items-center">
        <select
          value={mm}
          onChange={(e) =>
            onChange(`${hh.toString().padStart(2, "0")}:${Number(e.target.value).toString().padStart(2, "0")}`)
          }
          className="appearance-none bg-transparent pl-3 pr-6 py-2 text-sm font-mono font-semibold text-gray-800 focus:outline-none cursor-pointer"
        >
          {MINUTES.map((m) => (
            <option key={m} value={m}>{m.toString().padStart(2, "0")}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-1 w-3 h-3 text-gray-400" />
      </div>
    </div>
  );
}

// ── WorkingHoursEditor ────────────────────────────────────────────────────────
type Props = { value: WorkingHoursValue; onChange: (value: WorkingHoursValue) => void };

export function WorkingHoursEditor({ value, onChange }: Props) {
  function setDay(day: string, slot: [string, string] | null) {
    onChange({ ...value, [day]: slot });
  }

  function applyToWeekdays(template: [string, string]) {
    const next = { ...value };
    DAY_KEYS.filter((d) => DAYS[d].weekday).forEach((d) => { next[d] = [...template]; });
    onChange(next);
  }

  function applyToAll(template: [string, string]) {
    const next: WorkingHoursValue = {};
    DAY_KEYS.forEach((d) => { next[d] = [...template]; });
    onChange(next);
  }

  const openCount = DAY_KEYS.filter((d) => value[d] !== null && value[d] !== undefined).length;

  return (
    <div className="space-y-3">
      {/* Day chip summary */}
      <div className="flex items-center gap-2 flex-wrap">
        {DAY_KEYS.map((day) => {
          const open = value[day] !== null && value[day] !== undefined;
          return (
            <button
              key={day}
              type="button"
              onClick={() => setDay(day, open ? null : ["09:00", "18:00"])}
              className={cn(
                "w-10 h-10 rounded-xl text-xs font-bold transition-all",
                open ? "bg-brand-600 text-white shadow-sm" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
              )}
            >
              {DAYS[day].short}
            </button>
          );
        })}
        <span className="text-xs text-gray-400 ml-1">
          {openCount === 0 ? "Nenhum dia ativo" : `${openCount} dia${openCount > 1 ? "s" : ""} aberto${openCount > 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Rows */}
      <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
        {DAY_KEYS.map((day) => {
          const open = value[day] !== null && value[day] !== undefined;
          const slot = value[day] ?? ["09:00", "18:00"];

          return (
            <div
              key={day}
              className={cn(
                "flex items-center gap-4 px-4 py-3 transition-colors",
                open ? "bg-white" : "bg-gray-50/70"
              )}
            >
              {/* Abbreviated day badge only */}
              <span
                className={cn(
                  "w-10 text-center text-xs font-bold py-1.5 rounded-lg flex-shrink-0",
                  open ? "bg-brand-100 text-brand-700" : "bg-gray-100 text-gray-400"
                )}
              >
                {DAYS[day].short}
              </span>

              {/* Toggle */}
              <Toggle
                checked={open}
                onChange={(v) => setDay(day, v ? ["09:00", "18:00"] : null)}
              />

              {/* Time range or closed */}
              {open ? (
                <div className="flex items-center gap-2 flex-1 flex-wrap">
                  <TimePicker value={slot[0]} onChange={(t) => setDay(day, [t, slot[1]])} />
                  <ArrowRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                  <TimePicker value={slot[1]} onChange={(t) => setDay(day, [slot[0], t])} />

                  {DAYS[day].weekday && (
                    <button
                      type="button"
                      onClick={() => applyToWeekdays(slot as [string, string])}
                      className="ml-auto text-[11px] text-gray-400 hover:text-brand-600 transition-colors whitespace-nowrap hidden lg:block"
                    >
                      Aplicar a dias úteis
                    </button>
                  )}
                </div>
              ) : (
                <span className="flex-1 text-xs text-gray-400">Fechado</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 flex-wrap pt-0.5">
        {[
          { label: "Dias úteis 09h–18h", action: () => applyToWeekdays(["09:00", "18:00"]) },
          { label: "Todos os dias 09h–18h", action: () => applyToAll(["09:00", "18:00"]) },
          { label: "Restaurar padrão", action: () => onChange(defaultWorkingHours()) },
        ].map(({ label, action }) => (
          <button
            key={label}
            type="button"
            onClick={action}
            className="text-xs text-gray-500 hover:text-brand-600 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors hover:border-brand-300 hover:bg-brand-50"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

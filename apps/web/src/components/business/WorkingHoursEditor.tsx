"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TemplateMessageField } from "@/components/business/TemplateMessageField";
import { Switch } from "@/components/ui/switch";

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

const pad = (n: number) => String(n).padStart(2, "0");

const ITEM_H = 32;
const COL_H  = 96;
const SPACER = (COL_H - ITEM_H) / 2;

export type WorkingHoursValue = Record<string, [string, string] | null>;
export type SpecialHoursValue = Record<string, [string, string] | null>;
export type LunchBreakValue = [string, string] | null;

export function defaultWorkingHours(): WorkingHoursValue {
  const h: WorkingHoursValue = {};
  DAY_KEYS.forEach((d) => { h[d] = d === "sun" ? null : ["09:00", "18:00"]; });
  return h;
}

export const ALL_DAY_HOURS: [string, string] = ["00:00", "24:00"];

export function isAllDayHours(slot: [string, string] | null | undefined): boolean {
  if (!slot) return false;
  return slot[0] === "00:00" && (slot[1] === "24:00" || slot[1] === "23:59");
}

// ── TimePicker ────────────────────────────────────────────────────────────────
function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parts = value.split(":");
  const hh = parseInt(parts[0] ?? "09", 10);
  const mm = parseInt(parts[1] ?? "00", 10);
  const latestValueRef = useRef(value);

  const hourRef = useRef<HTMLDivElement>(null);
  const minRef  = useRef<HTMLDivElement>(null);
  const hDrag    = useRef<{ startY: number; startTop: number } | null>(null);
  const hDragged = useRef(false);
  const mDrag    = useRef<{ startY: number; startTop: number } | null>(null);
  const mDragged = useRef(false);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (hourRef.current) hourRef.current.scrollTop = hh * ITEM_H;
    if (minRef.current)  minRef.current.scrollTop  = mm * ITEM_H;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function getCurrentParts() {
    const [hRaw, mRaw] = (latestValueRef.current ?? "09:00").split(":");
    const currentHour = Number.parseInt(hRaw ?? "09", 10);
    const currentMinute = Number.parseInt(mRaw ?? "00", 10);
    return {
      currentHour: Number.isFinite(currentHour) ? currentHour : 9,
      currentMinute: Number.isFinite(currentMinute) ? currentMinute : 0,
    };
  }

  function onHourDown(e: React.PointerEvent<HTMLDivElement>) {
    hDragged.current = false;
    hDrag.current = { startY: e.clientY, startTop: hourRef.current?.scrollTop ?? 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onHourMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!hDrag.current || !hourRef.current) return;
    const dy = e.clientY - hDrag.current.startY;
    if (Math.abs(dy) > 3) hDragged.current = true;
    hourRef.current.scrollTop = hDrag.current.startTop - dy;
  }
  function onHourUp() {
    if (!hDrag.current || !hourRef.current) return;
    hDrag.current = null;
    if (!hDragged.current) return;
    const h = Math.max(0, Math.min(23, Math.round(hourRef.current.scrollTop / ITEM_H)));
    const { currentMinute } = getCurrentParts();
    onChange(`${pad(h)}:${pad(currentMinute)}`);
    hourRef.current.scrollTo({ top: h * ITEM_H, behavior: "smooth" });
  }

  function onMinDown(e: React.PointerEvent<HTMLDivElement>) {
    mDragged.current = false;
    mDrag.current = { startY: e.clientY, startTop: minRef.current?.scrollTop ?? 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onMinMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!mDrag.current || !minRef.current) return;
    const dy = e.clientY - mDrag.current.startY;
    if (Math.abs(dy) > 3) mDragged.current = true;
    minRef.current.scrollTop = mDrag.current.startTop - dy;
  }
  function onMinUp() {
    if (!mDrag.current || !minRef.current) return;
    mDrag.current = null;
    if (!mDragged.current) return;
    const m = Math.max(0, Math.min(59, Math.round(minRef.current.scrollTop / ITEM_H)));
    const { currentHour } = getCurrentParts();
    onChange(`${pad(currentHour)}:${pad(m)}`);
    minRef.current.scrollTo({ top: m * ITEM_H, behavior: "smooth" });
  }

  const colBase = "overflow-y-auto [&::-webkit-scrollbar]:hidden cursor-grab active:cursor-grabbing select-none w-9";

  return (
    <div className="inline-flex items-center rounded-xl border border-gray-200 bg-white overflow-hidden hover:border-brand-300 transition-colors px-1">
      {/* Hour */}
      <div className="relative">
        <div className="absolute top-0 inset-x-0 h-6 bg-gradient-to-b from-white to-transparent pointer-events-none z-10" />
        <div className="absolute bottom-0 inset-x-0 h-6 bg-gradient-to-t from-white to-transparent pointer-events-none z-10" />
        <div className="absolute top-1/2 -translate-y-1/2 inset-x-0 h-8 bg-brand-50/70 border-y border-brand-100 pointer-events-none z-0" />
        <div
          ref={hourRef}
          className={colBase}
          style={{ height: COL_H, scrollbarWidth: "none" }}
          onPointerDown={onHourDown}
          onPointerMove={onHourMove}
          onPointerUp={onHourUp}
          onPointerCancel={onHourUp}
        >
          <div style={{ height: SPACER }} />
          {Array.from({ length: 24 }, (_, h) => (
            <Button key={h} type="button" variant="ghost" style={{ height: ITEM_H }}
              onClick={() => {
                if (hDragged.current) return;
                const { currentMinute } = getCurrentParts();
                onChange(`${pad(h)}:${pad(currentMinute)}`);
                hourRef.current?.scrollTo({ top: h * ITEM_H, behavior: "smooth" });
              }}
              className={cn(
                "relative z-10 w-full h-auto flex items-center justify-center font-mono font-semibold transition-all rounded-lg p-0 min-w-0",
                h === hh ? "text-brand-700 text-xs" : "text-[11px] text-gray-400 hover:text-gray-700",
              )}
            >{pad(h)}</Button>
          ))}
          <div style={{ height: SPACER }} />
        </div>
      </div>

      <span className="text-gray-300 text-xs font-bold select-none mx-0.5">:</span>

      {/* Minute */}
      <div className="relative">
        <div className="absolute top-0 inset-x-0 h-6 bg-gradient-to-b from-white to-transparent pointer-events-none z-10" />
        <div className="absolute bottom-0 inset-x-0 h-6 bg-gradient-to-t from-white to-transparent pointer-events-none z-10" />
        <div className="absolute top-1/2 -translate-y-1/2 inset-x-0 h-8 bg-brand-50/70 border-y border-brand-100 pointer-events-none z-0" />
        <div
          ref={minRef}
          className={colBase}
          style={{ height: COL_H, scrollbarWidth: "none" }}
          onPointerDown={onMinDown}
          onPointerMove={onMinMove}
          onPointerUp={onMinUp}
          onPointerCancel={onMinUp}
        >
          <div style={{ height: SPACER }} />
          {Array.from({ length: 60 }, (_, m) => (
            <Button key={m} type="button" variant="ghost" style={{ height: ITEM_H }}
              onClick={() => {
                if (mDragged.current) return;
                const { currentHour } = getCurrentParts();
                onChange(`${pad(currentHour)}:${pad(m)}`);
                minRef.current?.scrollTo({ top: m * ITEM_H, behavior: "smooth" });
              }}
              className={cn(
                "relative z-10 w-full h-auto flex items-center justify-center font-mono font-semibold transition-all rounded-lg p-0 min-w-0",
                m === mm ? "text-brand-700 text-xs" : "text-[11px] text-gray-400 hover:text-gray-700",
              )}
            >{pad(m)}</Button>
          ))}
          <div style={{ height: SPACER }} />
        </div>
      </div>
    </div>
  );
}

// ── WorkingHoursEditor ────────────────────────────────────────────────────────
export type ScheduleCommitSnapshot = {
  workingHours: WorkingHoursValue;
  specialHours: SpecialHoursValue;
  lunchBreak: LunchBreakValue;
  lunchMsg: string;
};

type Props = {
  value: WorkingHoursValue;
  onChange: (value: WorkingHoursValue) => void;
  specialHours: SpecialHoursValue;
  onSpecialHoursChange: (value: SpecialHoursValue) => void;
  lunchBreak: LunchBreakValue;
  onLunchBreakChange: (value: LunchBreakValue) => void;
  lunchMsg: string;
  onLunchMsgChange: (value: string) => void;
  onCommit?: (snapshot: ScheduleCommitSnapshot) => void;
};

export function WorkingHoursEditor({
  value,
  onChange,
  specialHours,
  onSpecialHoursChange,
  lunchBreak,
  onLunchBreakChange,
  lunchMsg,
  onLunchMsgChange,
  onCommit,
}: Props) {
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [specialDate, setSpecialDate] = useState("");
  const [specialOpen, setSpecialOpen] = useState("09:00");
  const [specialClose, setSpecialClose] = useState("18:00");
  const [specialClosed, setSpecialClosed] = useState(false);
  const [todayCloseAt, setTodayCloseAt] = useState("18:00");

  function commit(next?: Partial<ScheduleCommitSnapshot>) {
    onCommit?.({
      workingHours: next?.workingHours ?? value,
      specialHours: next?.specialHours ?? specialHours,
      lunchBreak: next?.lunchBreak ?? lunchBreak,
      lunchMsg: next?.lunchMsg ?? lunchMsg,
    });
  }

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
  const is24hActive = DAY_KEYS.every((d) => isAllDayHours(value[d]));
  const specialEntries = Object.entries(specialHours).sort(([a], [b]) => a.localeCompare(b));

  function dateKeyFromOffset(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function dayKeyFromDate(date: Date) {
    const map = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
    return map[date.getDay()];
  }

  function closeTodayAt(time: string) {
    const today = new Date();
    const todayKey = dateKeyFromOffset(0);
    const dayKey = dayKeyFromDate(today);
    const baseSlot = specialHours[todayKey] ?? value[dayKey] ?? ["09:00", "18:00"];
    const openAt = baseSlot ? baseSlot[0] : "09:00";
    const nextSpecial = { ...specialHours, [todayKey]: [openAt, time] as [string, string] };
    onSpecialHoursChange(nextSpecial);
    commit({ specialHours: nextSpecial });
  }

  function addSpecialDay() {
    if (!specialDate) return;
    const slot: [string, string] | null = specialClosed ? null : [specialOpen, specialClose];
    const nextSpecial = { ...specialHours, [specialDate]: slot };
    onSpecialHoursChange(nextSpecial);
    commit({ specialHours: nextSpecial });
    setSpecialDate("");
    setSpecialClosed(false);
  }

  return (
    <div className="space-y-3">
      {/* Day chip summary */}
      <div className="flex items-center gap-2 flex-wrap">
        {DAY_KEYS.map((day) => {
          const open = value[day] !== null && value[day] !== undefined;
          return (
            <Button
              key={day}
              type="button"
              variant="ghost"
              onClick={() => {
                const nowOpen = !open;
                setDay(day, nowOpen ? ["09:00", "18:00"] : null);
                setEditingDay(nowOpen ? day : (editingDay === day ? null : editingDay));
              }}
              className={cn(
                "w-10 h-10 rounded-xl text-xs font-bold p-0 min-w-0",
                open ? "bg-brand-600 text-white shadow-sm hover:bg-brand-600" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
              )}
            >
              {DAYS[day].short}
            </Button>
          );
        })}
        <span className="text-xs text-gray-400 ml-1">
          {openCount === 0
            ? "Nenhum dia ativo"
            : `${openCount} dia${openCount > 1 ? "s" : ""} aberto${openCount > 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Rows */}
      <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
        {DAY_KEYS.map((day) => {
          const open = value[day] !== null && value[day] !== undefined;
          const slot = value[day] ?? ["09:00", "18:00"];
          const isEditing = editingDay === day;

          return (
            <div
              key={day}
              className={cn(
                "flex items-center gap-3 px-4 transition-colors",
                isEditing ? "py-3" : "py-2.5",
                open ? "bg-white" : "bg-gray-50/70"
              )}
            >
              {/* Day badge */}
              <span
                className={cn(
                  "w-9 text-center text-xs font-bold py-1.5 rounded-lg flex-shrink-0",
                  open ? "bg-brand-100 text-brand-700" : "bg-gray-100 text-gray-400"
                )}
              >
                {DAYS[day].short}
              </span>

              {/* Toggle */}
              <Switch
                checked={open}
                onCheckedChange={(v) => {
                  setDay(day, v ? ["09:00", "18:00"] : null);
                  if (v) setEditingDay(day);
                  else if (editingDay === day) setEditingDay(null);
                }}
              />

              {open ? (
                isEditing ? (
                  /* ── Edit mode ─────────────────────────────── */
                  <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                    <TimePicker value={slot[0]} onChange={(t) => setDay(day, [t, slot[1]])} />
                    <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
                    <TimePicker value={slot[1]} onChange={(t) => setDay(day, [slot[0], t])} />

                    <div className="flex items-center gap-3 ml-auto flex-shrink-0">
                      {DAYS[day].weekday && (
                        <Button
                          type="button"
                          variant="link"
                          onClick={() => applyToWeekdays(slot as [string, string])}
                          className="text-[11px] text-gray-400 hover:text-brand-600 whitespace-nowrap hidden lg:inline-flex h-auto p-0"
                        >
                          Aplicar a dias úteis
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setEditingDay(null);
                          commit();
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-800 h-auto px-0"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* ── Display mode ───────────────────────────── */
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {isAllDayHours(slot) ? (
                      <span className="text-sm font-semibold text-brand-700">24 horas</span>
                    ) : (
                      <>
                        <span className="text-sm font-mono font-semibold text-gray-700">{slot[0]}</span>
                        <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
                        <span className="text-sm font-mono font-semibold text-gray-700">{slot[1]}</span>
                      </>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setEditingDay(day)}
                      className="ml-auto inline-flex items-center gap-1 text-xs text-gray-400 hover:text-brand-600 flex-shrink-0 h-auto px-0"
                    >
                      <Pencil className="w-3 h-3" />
                      <span className="hidden sm:inline">Editar</span>
                    </Button>
                  </div>
                )
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
          {
            label: "Aberto 24h (todos os dias)",
            active: is24hActive,
            action: () => {
              applyToAll(ALL_DAY_HOURS);
              setEditingDay(null);
            },
          },
          { label: "Dias úteis 09h–18h", action: () => { applyToWeekdays(["09:00", "18:00"]); setEditingDay(null); } },
          { label: "Todos os dias 09h–18h", action: () => { applyToAll(["09:00", "18:00"]); setEditingDay(null); } },
          { label: "Restaurar padrão", action: () => { onChange(defaultWorkingHours()); setEditingDay(null); } },
        ].map(({ label, action, active }) => (
          <Button
            key={label}
            type="button"
            variant={active ? "default" : "outline"}
            size="xs"
            onClick={action}
            className={cn(
              "text-xs h-auto",
              active
                ? "bg-brand-600 text-white hover:bg-brand-700"
                : "text-gray-500 hover:text-brand-600 hover:border-brand-300 hover:bg-brand-50",
            )}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="rounded-xl border border-gray-200 p-3 space-y-3 bg-white">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Horário de almoço</p>
            <p className="text-xs text-gray-500 mt-0.5">
              No intervalo a IA envia a mensagem de almoço configurada abaixo.
            </p>
          </div>
          <Switch
            checked={lunchBreak !== null}
            onCheckedChange={(enabled) => {
              const nextLunch = enabled ? lunchBreak ?? ["12:00", "13:00"] : null;
              onLunchBreakChange(nextLunch);
              commit({ lunchBreak: nextLunch });
            }}
          />
        </div>
        {lunchBreak && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <TimePicker
                value={lunchBreak[0]}
                onChange={(t) => onLunchBreakChange([t, lunchBreak[1]])}
              />
              <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
              <TimePicker
                value={lunchBreak[1]}
                onChange={(t) => onLunchBreakChange([lunchBreak[0], t])}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => commit()}
                className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-800 h-auto px-0"
              >
                <Check className="w-3.5 h-3.5" />
                Aplicar horário
              </Button>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Mensagem no horário de almoço</label>
              <TemplateMessageField
                value={lunchMsg}
                onChange={onLunchMsgChange}
                rows={3}
                placeholder="Olá {nome}! Estamos em almoço no {negocio}. Voltamos em breve!"
              />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 p-3 space-y-3 bg-white">
        <p className="text-sm font-semibold text-gray-900">Horários excepcionais por data</p>
        <p className="text-xs text-gray-500">
          Use para feriado, evento ou dia atípico. Esta data sobrescreve o horário semanal.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-[140px_1fr_1fr_auto] gap-2 items-center">
          <input
            type="date"
            value={specialDate}
            onChange={(e) => setSpecialDate(e.target.value)}
            className="input"
          />
          <input
            type="time"
            value={specialOpen}
            onChange={(e) => setSpecialOpen(e.target.value)}
            className="input"
            disabled={specialClosed}
          />
          <input
            type="time"
            value={specialClose}
            onChange={(e) => setSpecialClose(e.target.value)}
            className="input"
            disabled={specialClosed}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addSpecialDay}
            className="text-xs border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 h-auto"
            disabled={!specialDate}
          >
            Adicionar
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5">
            <span className="text-xs text-amber-800">Fechar hoje às</span>
            <input
              type="time"
              value={todayCloseAt}
              onChange={(e) => setTodayCloseAt(e.target.value)}
              className="input h-8 w-[110px] py-1"
            />
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => closeTodayAt(todayCloseAt)}
              className="text-xs border-amber-300 bg-white text-amber-800 hover:bg-amber-100 h-auto"
            >
              Aplicar
            </Button>
          </div>
          <Button
            type="button"
            variant="destructive"
            size="xs"
            onClick={() => {
              const nextSpecial = { ...specialHours, [dateKeyFromOffset(0)]: null };
              onSpecialHoursChange(nextSpecial);
              commit({ specialHours: nextSpecial });
            }}
            className="text-xs h-auto"
          >
            Fechar hoje o dia todo
          </Button>
        </div>
        <label className="inline-flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={specialClosed}
            onChange={(e) => setSpecialClosed(e.target.checked)}
          />
          Fechado nesta data
        </label>

        {specialEntries.length > 0 && (
          <div className="space-y-2">
            {specialEntries.map(([day, slot]) => (
              <div
                key={day}
                className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
              >
                <div className="text-xs text-gray-700">
                  <span className="font-semibold">{day}</span>
                  <span className="ml-2">
                    {slot ? `${slot[0]} → ${slot[1]}` : "Fechado"}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    const next = { ...specialHours };
                    delete next[day];
                    onSpecialHoursChange(next);
                    commit({ specialHours: next });
                  }}
                  className="text-xs text-red-600 hover:text-red-700 h-auto px-0"
                >
                  Remover
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

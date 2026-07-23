"use client";

import { useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { TimePicker } from "@/components/ui/time-picker";
import { cn } from "@/lib/utils";
import {
  MAX_SCHEDULE_DAYS,
  dateDayKey,
  isDayKeyWithinScheduleHorizon,
  parseDayKey,
} from "@flowdesk/firebase/client";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const pad = (n: number) => String(n).padStart(2, "0");

type Props = {
  selectedDayKeys: string[];
  onSelectedDayKeysChange: (keys: string[]) => void;
  selectedHour: number;
  selectedMinute: number;
  onHourChange: (h: number) => void;
  onMinuteChange: (m: number) => void;
  mountedAt?: Date;
  disableDaySelection?: boolean;
};

export function StatusMultiDayPicker({
  selectedDayKeys,
  onSelectedDayKeysChange,
  selectedHour,
  selectedMinute,
  onHourChange,
  onMinuteChange,
  mountedAt: mountedAtProp,
  disableDaySelection = false,
}: Props) {
  const fallbackMounted = useMemo(() => new Date(), []);
  const mountedAt = mountedAtProp ?? fallbackMounted;
  const calendarGridRef = useRef<HTMLDivElement>(null);
  const calendarDragRef = useRef<{
    mode: "select" | "deselect";
    snapshot: string[];
    visited: Set<string>;
    moved: boolean;
    startDate: Date;
    startKey: string;
    lastKey: string;
  } | null>(null);
  const maxDaysToastRef = useRef(false);
  const [dragVisited, setDragVisited] = useState<string[]>([]);

  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const hasTodaySelected = useMemo(
    () =>
      selectedDayKeys.some((key) => {
        const d = parseDayKey(key);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
      }),
    [selectedDayKeys, today]
  );

  const summary = useMemo(() => {
    const t = `${pad(selectedHour)}:${pad(selectedMinute)}`;
    const n = selectedDayKeys.length;
    if (n === 0) return `Selecione os dias · ${t}`;
    if (n === 1) {
      const d = parseDayKey(selectedDayKeys[0]!);
      const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
      if (diff === 0) return `Hoje às ${t}`;
      if (diff === 1) return `Amanhã às ${t}`;
      return `${format(d, "EEE, dd 'de' MMM", { locale: ptBR })} às ${t}`;
    }
    return `${n} dias às ${t}`;
  }, [selectedDayKeys, selectedHour, selectedMinute, today]);


  function fixTodayTimeIfNeeded(date: Date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() !== today.getTime()) return;
    const nowH = mountedAt.getHours();
    const nowM = mountedAt.getMinutes();
    if (selectedHour < nowH || (selectedHour === nowH && selectedMinute < nowM)) {
      const newM = nowM + 1 >= 60 ? 0 : nowM + 1;
      const newH = nowM + 1 >= 60 ? Math.min(nowH + 1, 23) : nowH;
      onHourChange(newH);
      onMinuteChange(newM);
    }
  }

  function toggleDay(date: Date) {
    const key = dateDayKey(date);
    if (!isDayKeyWithinScheduleHorizon(key)) {
      toast.error(`Agende somente nos próximos ${MAX_SCHEDULE_DAYS} dias.`);
      return;
    }
    if (selectedDayKeys.includes(key)) {
      onSelectedDayKeysChange(selectedDayKeys.filter((k) => k !== key));
      return;
    }
    if (selectedDayKeys.length >= MAX_SCHEDULE_DAYS) {
      toast.error(`Máximo ${MAX_SCHEDULE_DAYS} dias por vez.`);
      return;
    }
    onSelectedDayKeysChange([...selectedDayKeys, key].sort());
    fixTodayTimeIfNeeded(date);
  }

  function syncCalendarDragSelection() {
    const drag = calendarDragRef.current;
    if (!drag) return;
    const next = new Set(drag.snapshot);
    for (const key of drag.visited) {
      if (drag.mode === "select") next.add(key);
      else next.delete(key);
    }
    const arr = [...next].sort();
    if (arr.length > MAX_SCHEDULE_DAYS) {
      if (!maxDaysToastRef.current) {
        maxDaysToastRef.current = true;
        toast.error(`Máximo ${MAX_SCHEDULE_DAYS} dias por vez.`);
      }
      onSelectedDayKeysChange(arr.slice(0, MAX_SCHEDULE_DAYS));
      return;
    }
    maxDaysToastRef.current = false;
    onSelectedDayKeysChange(arr);
    setDragVisited([...drag.visited]);
    if (drag.mode === "select") {
      for (const key of drag.visited) {
        if (parseDayKey(key).toDateString() === today.toDateString()) {
          fixTodayTimeIfNeeded(today);
          break;
        }
      }
    }
  }

  function addDayRangeToVisited(visited: Set<string>, fromKey: string, toKey: string) {
    const a = parseDayKey(fromKey);
    const b = parseDayKey(toKey);
    const lo = a.getTime() <= b.getTime() ? a : b;
    const hi = a.getTime() <= b.getTime() ? b : a;
    const cur = new Date(lo);
    cur.setHours(0, 0, 0, 0);
    const end = new Date(hi);
    end.setHours(0, 0, 0, 0);
    while (cur.getTime() <= end.getTime()) {
      if (cur >= today && isDayKeyWithinScheduleHorizon(dateDayKey(cur))) visited.add(dateDayKey(cur));
      cur.setDate(cur.getDate() + 1);
    }
  }

  function dayKeyFromPointer(e: React.PointerEvent): string | null {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const btn = el?.closest<HTMLElement>("[data-day-key]");
    const key = btn?.dataset.dayKey;
    if (!key) return null;
    const d = parseDayKey(key);
    d.setHours(0, 0, 0, 0);
    if (d < today || !isDayKeyWithinScheduleHorizon(key)) return null;
    return key;
  }

  function onCalendarGridPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const key = dayKeyFromPointer(e);
    if (!key) return;
    const date = parseDayKey(key);
    e.preventDefault();
    calendarDragRef.current = {
      mode: selectedDayKeys.includes(key) ? "deselect" : "select",
      snapshot: [...selectedDayKeys],
      visited: new Set([key]),
      moved: false,
      startDate: date,
      startKey: key,
      lastKey: key,
    };
    setDragVisited([key]);
    calendarGridRef.current?.setPointerCapture(e.pointerId);
  }

  function onCalendarGridPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = calendarDragRef.current;
    if (!drag) return;
    const key = dayKeyFromPointer(e);
    if (!key || key === drag.lastKey) return;
    addDayRangeToVisited(drag.visited, drag.lastKey, key);
    drag.lastKey = key;
    drag.moved = true;
    syncCalendarDragSelection();
  }

  function onCalendarGridPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const drag = calendarDragRef.current;
    if (!drag) return;
    try {
      calendarGridRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (!drag.moved) toggleDay(drag.startDate);
    else syncCalendarDragSelection();
    calendarDragRef.current = null;
    setDragVisited([]);
    maxDaysToastRef.current = false;
  }

  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewMonth.year, viewMonth.month, 1);
    const startDow = firstDay.getDay();
    const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(viewMonth.year, viewMonth.month, d));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewMonth]);

  return (
    <div>
      <Label className="block mb-1">Dias e horário</Label>
      <p className="text-xs text-gray-500 mb-3">
        {disableDaySelection
          ? "Datas geradas pela recorrência. Mude para Única/manual para marcar no calendário."
          : "Clique ou arraste no calendário. Máximo 7 dias à frente, mesmo horário para todos."}
      </p>

      <div className="flex items-center gap-2.5 mb-4 px-4 py-2.5 rounded-xl bg-brand-50 border border-brand-100">
        <CalendarClock className="w-4 h-4 text-brand-600 flex-shrink-0" />
        <span className="text-sm font-semibold text-brand-800 capitalize">{summary}</span>
      </div>

      {selectedDayKeys.length > 1 && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-[10px] font-bold text-brand-600 uppercase tracking-widest">
              {disableDaySelection ? "Datas geradas" : `${selectedDayKeys.length} selecionadas`}
            </span>
            <div className="flex-1 h-px bg-brand-100" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-0.5 px-0.5">
            {[...selectedDayKeys].sort().map((key) => {
              const date = parseDayKey(key);
              return (
                <div
                  key={key}
                  className="flex-shrink-0 flex flex-col items-center w-[50px] pt-2.5 pb-2 rounded-2xl border border-brand-200/80 bg-gradient-to-b from-brand-50 to-white shadow-sm"
                >
                  <span className="text-[9px] font-bold uppercase tracking-wider text-brand-400 leading-none">
                    {format(date, "EEE", { locale: ptBR })}
                  </span>
                  <span className="text-xl font-black text-brand-700 leading-none mt-1">
                    {format(date, "dd")}
                  </span>
                  <span className="text-[9px] font-semibold text-brand-500 leading-none mt-0.5">
                    {format(date, "MMM", { locale: ptBR })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/40">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() =>
                setViewMonth((v) =>
                  v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 }
                )
              }
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm transition-all"
            >
              <ChevronLeft className="w-4 h-4 text-gray-500" />
            </button>
            <span className="text-sm font-semibold text-gray-800">
              {MONTH_NAMES[viewMonth.month]} {viewMonth.year}
            </span>
            <button
              type="button"
              onClick={() =>
                setViewMonth((v) =>
                  v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 }
                )
              }
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm transition-all"
            >
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
              <div key={i} className="text-center text-[11px] text-gray-400 font-medium py-1">
                {d}
              </div>
            ))}
          </div>

          <div
            ref={calendarGridRef}
            className="grid grid-cols-7 gap-0.5 select-none touch-none"
            onPointerDownCapture={disableDaySelection ? undefined : onCalendarGridPointerDown}
            onPointerMove={disableDaySelection ? undefined : onCalendarGridPointerMove}
            onPointerUp={disableDaySelection ? undefined : onCalendarGridPointerUp}
            onPointerCancel={disableDaySelection ? undefined : onCalendarGridPointerUp}
          >
            {calendarCells.map((date, i) => {
              if (!date) return <div key={i} />;
              const key = dateDayKey(date);
              const isPast = date < today;
              const isBeyondHorizon = !isDayKeyWithinScheduleHorizon(key);
              const isMarked = selectedDayKeys.includes(key);
              const isDragPaint = dragVisited.includes(key);
              const isTodayCell = date.toDateString() === today.toDateString();
              return (
                <button
                  key={i}
                  type="button"
                  data-day-key={key}
                  disabled={isPast || isBeyondHorizon || disableDaySelection}
                  tabIndex={-1}
                  className={cn(
                    "aspect-square text-xs rounded-lg flex items-center justify-center transition-colors font-medium",
                    (isPast || isBeyondHorizon) && "text-gray-300 cursor-not-allowed",
                    !isPast &&
                      !isBeyondHorizon &&
                      !isMarked &&
                      !isDragPaint &&
                      !disableDaySelection &&
                      "text-gray-700 hover:bg-brand-100 hover:text-brand-800 cursor-cell",
                    !isPast && !isBeyondHorizon && !isMarked && !isDragPaint && disableDaySelection && "text-gray-500",
                    isTodayCell && !isMarked && !isDragPaint && "text-brand-600 font-bold ring-1 ring-brand-300",
                    (isMarked || (isDragPaint && calendarDragRef.current?.mode === "select")) &&
                      "bg-brand-600 text-white shadow-md scale-105",
                    isDragPaint &&
                      calendarDragRef.current?.mode === "deselect" &&
                      !isMarked &&
                      "bg-brand-100 text-brand-800 ring-2 ring-brand-400",
                  )}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/40 flex flex-col gap-3">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Horário</span>
          </div>

          <TimePicker
            value={`${pad(selectedHour)}:${pad(selectedMinute)}`}
            onChange={(time) => {
              const [h, m] = time.split(":").map(Number);
              onHourChange(h ?? 0);
              onMinuteChange(m ?? 0);
            }}
            minTime={hasTodaySelected ? `${pad(mountedAt.getHours())}:${pad(mountedAt.getMinutes())}` : undefined}
          />
        </div>
      </div>
    </div>
  );
}

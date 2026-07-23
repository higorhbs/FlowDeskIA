"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const ITEM_H = 32;
const COL_H = 96;
const SPACER = (COL_H - ITEM_H) / 2;

const pad = (n: number) => String(n).padStart(2, "0");

export function TimePicker({
  value,
  onChange,
  minTime,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Format "HH:MM". Hours/minutes before this are shown disabled and can't be picked. */
  minTime?: string;
}) {
  const parts = value.split(":");
  const hh = parseInt(parts[0] ?? "09", 10);
  const mm = parseInt(parts[1] ?? "00", 10);
  const latestValueRef = useRef(value);

  const [minHour, minMinute] = minTime
    ? minTime.split(":").map((n) => parseInt(n, 10))
    : [undefined, undefined];

  const hourRef = useRef<HTMLDivElement>(null);
  const minRef  = useRef<HTMLDivElement>(null);
  const hDrag    = useRef<{ startY: number; startTop: number } | null>(null);
  const hDragged = useRef(false);
  const mDrag    = useRef<{ startY: number; startTop: number } | null>(null);
  const mDragged = useRef(false);
  const didMountRef = useRef(false);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  // Keeps the wheels in sync whenever `value` changes — from the user
  // dragging/clicking here, or from the parent updating it externally.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      if (hourRef.current) hourRef.current.scrollTop = hh * ITEM_H;
      if (minRef.current)  minRef.current.scrollTop  = mm * ITEM_H;
      return;
    }
    hourRef.current?.scrollTo({ top: hh * ITEM_H, behavior: "smooth" });
    minRef.current?.scrollTo({ top: mm * ITEM_H, behavior: "smooth" });
  }, [hh, mm]);

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
          {Array.from({ length: 24 }, (_, h) => {
            const disabled = minHour !== undefined && h < minHour;
            return (
              <Button key={h} type="button" variant="ghost" disabled={disabled} style={{ height: ITEM_H }}
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
            );
          })}
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
          {Array.from({ length: 60 }, (_, m) => {
            const disabled = minHour !== undefined && hh === minHour && m < (minMinute ?? 0);
            return (
              <Button key={m} type="button" variant="ghost" disabled={disabled} style={{ height: ITEM_H }}
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
            );
          })}
          <div style={{ height: SPACER }} />
        </div>
      </div>
    </div>
  );
}

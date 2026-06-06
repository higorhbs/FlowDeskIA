"use client";

import { cn } from "@/lib/utils";

type SwitchProps = {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  size?: "default" | "sm";
  className?: string;
  title?: string;
  interactive?: boolean;
};

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  size = "default",
  className,
  title,
  interactive = true,
}: SwitchProps) {
  const sm = size === "sm";
  const track = cn(
    "relative shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
    sm ? "h-5 w-9" : "h-6 w-11",
    checked ? "bg-brand-600" : "bg-gray-200",
    interactive && "cursor-pointer outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    disabled && "cursor-not-allowed opacity-50",
    className
  );
  const thumb = cn(
    "pointer-events-none absolute top-0.5 left-0.5 block rounded-full bg-white shadow transition-transform duration-200 ease-in-out",
    sm ? "h-4 w-4" : "h-5 w-5",
    checked ? (sm ? "translate-x-4" : "translate-x-5") : "translate-x-0"
  );

  if (!interactive) {
    return (
      <div className={track} aria-hidden>
        <span className={thumb} />
      </div>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      title={title}
      onClick={() => !disabled && onCheckedChange?.(!checked)}
      className={track}
    >
      <span className={thumb} />
    </button>
  );
}

"use client";

import {
  Scissors,
  UtensilsCrossed,
  Stethoscope,
  Store,
  LayoutGrid,
  Check,
} from "lucide-react";
import { BUSINESS_TYPE_LABELS, BUSINESS_TYPE_ORDER, type BusinessType } from "@flowdesk/shared";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const BUSINESS_TYPE_META: Record<
  BusinessType,
  { icon: typeof Store; color: string }
> = {
  STORE: { icon: Store, color: "bg-violet-50 text-violet-700 border-violet-200" },
  BARBERSHOP: { icon: Scissors, color: "bg-slate-100 text-slate-700 border-slate-200" },
  RESTAURANT: { icon: UtensilsCrossed, color: "bg-orange-50 text-orange-700 border-orange-200" },
  DENTAL: { icon: Stethoscope, color: "bg-teal-50 text-teal-700 border-teal-200" },
  OTHER: { icon: LayoutGrid, color: "bg-gray-100 text-gray-700 border-gray-200" },
};

const BUSINESS_TYPE_OPTIONS = BUSINESS_TYPE_ORDER.map((value) => ({
  value,
  label: BUSINESS_TYPE_LABELS[value],
  ...BUSINESS_TYPE_META[value],
}));

type Props = {
  value: string;
  onChange: (value: BusinessType) => void;
  typeLabel?: string;
  onTypeLabelChange?: (label: string) => void;
  typeLabelError?: string;
  error?: string;
};

export function BusinessTypePicker({
  value,
  onChange,
  typeLabel = "",
  onTypeLabelChange,
  typeLabelError,
  error,
}: Props) {
  const isOther = value === "OTHER";

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        {BUSINESS_TYPE_OPTIONS.map(({ value: id, label, icon: Icon, color }) => {
          const selected = value === id;
          const cardLabel = id === "OTHER" && selected && typeLabel.trim() ? typeLabel.trim() : label;
          return (
            <Button
              key={id}
              type="button"
              variant="outline"
              onClick={() => {
                onChange(id);
                if (id !== "OTHER") onTypeLabelChange?.("");
              }}
              className={cn(
                "relative h-auto flex flex-col items-center gap-3 py-5 px-3 rounded-xl border-2 text-center transition-all",
                "hover:shadow-sm",
                selected
                  ? "border-brand-500 bg-brand-50/80 shadow-sm"
                  : "border-gray-200 bg-white hover:border-gray-300"
              )}
            >
              {selected && (
                <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                </span>
              )}
              <span
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center border",
                  color,
                  selected && "ring-2 ring-brand-400 ring-offset-1"
                )}
              >
                <Icon className="w-6 h-6" />
              </span>
              <span
                className={cn(
                  "text-xs font-medium leading-tight line-clamp-2",
                  selected ? "text-brand-800" : "text-gray-700"
                )}
              >
                {cardLabel}
              </span>
            </Button>
          );
        })}
      </div>

      {isOther && (
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="business-type-label">Nome do tipo de negócio</Label>
          <Input
            id="business-type-label"
            value={typeLabel}
            onChange={(e) => onTypeLabelChange?.(e.target.value)}
            placeholder="Ex.: Pet shop, Academia, Escritório..."
            maxLength={60}
          />
          <p className="text-xs text-gray-500">Esse nome aparece para você em todo o painel.</p>
          {typeLabelError ? <p className="text-xs text-red-500">{typeLabelError}</p> : null}
        </div>
      )}

      {error ? <p className="text-xs text-red-500 mt-2">{error}</p> : null}
    </div>
  );
}

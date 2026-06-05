"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, RotateCcw, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ScheduledStatus } from "@/lib/api";
import { scheduledStatusApi } from "@/lib/api";
import { StatusMultiDayPicker } from "@/components/status/StatusMultiDayPicker";
import {
  RecurrenceMode,
  StatusRecurrenceControls,
} from "@/components/status/StatusRecurrenceControls";
import { dateDayKey } from "@flowdesk/firebase/client";

function defaultSchedule() {
  const d = new Date(Date.now() + 15 * 60_000);
  d.setSeconds(0, 0);
  return d;
}

type Props = {
  businessId: string;
  row: ScheduledStatus;
  onClose: () => void;
  onScheduled: () => void;
};

export function RepostStatusModal({ businessId, row, onClose, onScheduled }: Props) {
  const initial = useMemo(() => {
    const fromRow = new Date(row.scheduledAt);
    return Number.isFinite(fromRow.getTime()) && fromRow.getTime() > Date.now() + 60_000
      ? fromRow
      : defaultSchedule();
  }, [row.scheduledAt]);

  const [selectedDayKeys, setSelectedDayKeys] = useState<string[]>(() => [dateDayKey(initial)]);
  const [recurrenceMode, setRecurrenceMode] = useState<RecurrenceMode>("none");
  const [recurrenceIntervalDays, setRecurrenceIntervalDays] = useState<number>(1);
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>([initial.getDay()]);
  const [recurrenceStartDayKey, setRecurrenceStartDayKey] = useState<string>(dateDayKey(initial));
  const [selectedHour, setSelectedHour] = useState(initial.getHours());
  const [selectedMinute, setSelectedMinute] = useState(initial.getMinutes());
  const [publishNow, setPublishNow] = useState(false);
  const mountedAt = useMemo(() => new Date(), []);

  const repostMutation = useMutation({
    mutationFn: () => {
      if (!publishNow && selectedDayKeys.length === 0) {
        throw new Error("Selecione pelo menos um dia no calendário.");
      }
      return scheduledStatusApi.repost(businessId, row.id, {
        publishNow,
        scheduledDays: publishNow ? [] : selectedDayKeys,
        hour: selectedHour,
        minute: selectedMinute,
      });
    },
    onSuccess: (rows) => {
      toast.success(
        publishNow
          ? "Story enfileirado para publicação imediata!"
          : rows.length > 1
            ? `${rows.length} republicações agendadas!`
            : "Story reagendado!",
      );
      onScheduled();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message ?? "Erro ao reagendar"),
  });

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4"
      onClick={() => !repostMutation.isPending && onClose()}
      role="presentation"
    >
      <Card
        className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="repost-status-title"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 id="repost-status-title" className="text-lg font-semibold text-gray-900">
              Reagendar story
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Mesma arte{row.caption ? " e legenda" : ""} nos dias que você marcar.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={repostMutation.isPending}
            className="p-1 text-gray-400 hover:text-gray-700"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-3 mb-5 p-3 rounded-xl bg-gray-50 border border-gray-100">
          <div className="w-16 h-16 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0">
            {row.mediaType === "video" ? (
              <video src={row.mediaUrl} className="w-full h-full object-cover" muted playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.mediaUrl} alt="" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            {row.caption && <p className="text-sm text-gray-800 line-clamp-2">{row.caption}</p>}
            <p className="text-xs text-gray-500 mt-1 capitalize">
              Original:{" "}
              {new Date(row.publishedAt ?? row.scheduledAt).toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </p>
          </div>
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3 cursor-pointer mb-5">
          <input
            type="checkbox"
            className="mt-1 rounded border-brand-300 text-brand-600 focus:ring-brand-500"
            checked={publishNow}
            onChange={(e) => setPublishNow(e.target.checked)}
            disabled={repostMutation.isPending}
          />
          <span className="text-sm text-gray-800">
            <span className="font-medium flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-brand-600" />
              Publicar agora
            </span>
            <span className="block text-xs text-gray-600 mt-0.5">
              Envia em alguns segundos (WhatsApp precisa estar conectado).
            </span>
          </span>
        </label>

        {!publishNow && (
          <div className="mb-6">
            <StatusMultiDayPicker
              selectedDayKeys={selectedDayKeys}
              onSelectedDayKeysChange={setSelectedDayKeys}
              selectedHour={selectedHour}
              selectedMinute={selectedMinute}
              onHourChange={setSelectedHour}
              onMinuteChange={setSelectedMinute}
              mountedAt={mountedAt}
              disableDaySelection={recurrenceMode !== "none"}
            />
            <div className="mt-3">
              <StatusRecurrenceControls
                mode={recurrenceMode}
                onModeChange={setRecurrenceMode}
                intervalDays={recurrenceIntervalDays}
                onIntervalDaysChange={setRecurrenceIntervalDays}
                weekdayNumbers={recurrenceWeekdays}
                onWeekdayNumbersChange={setRecurrenceWeekdays}
                startDayKey={recurrenceStartDayKey}
                onStartDayKeyChange={setRecurrenceStartDayKey}
                onApplyGeneratedDays={setSelectedDayKeys}
              />
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={repostMutation.isPending}
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={repostMutation.isPending || (!publishNow && selectedDayKeys.length === 0)}
            onClick={() => repostMutation.mutate()}
          >
            {repostMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : publishNow ? (
              <>
                <Zap className="w-4 h-4 mr-1.5" />
                Publicar agora
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4 mr-1.5" />
                Agendar
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}

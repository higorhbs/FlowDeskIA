"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  APP_DISPLAY_NAME,
  PLAN_LIMITS,
  formatPlanLimit,
  type PlanTier,
} from "@flowdesk/shared";
import { getClientTenantStoriesPublished } from "@flowdesk/firebase/client";
import { scheduledStatusApi, businessApi, tenantApi, type ScheduledStatus } from "@/lib/api";
import { useBusinessId } from "@/lib/use-business-id";
import { useAuth } from "@/contexts/auth-context";
import { useSyncWhatsAppBusiness } from "@/lib/use-sync-wa-business";
import { toast } from "sonner";
import {
  CircleDot,
  Upload,
  Loader2,
  CalendarClock,
  Zap,
  Trash2,
  AlertTriangle,
  ImageIcon,
  Video,
  CheckCircle2,
  XCircle,
  X,
  Play,
  Send,
  RotateCcw,
} from "lucide-react";
import { StatusMultiDayPicker } from "@/components/status/StatusMultiDayPicker";
import {
  RecurrenceMode,
  StatusRecurrenceControls,
} from "@/components/status/StatusRecurrenceControls";
import { RepostStatusModal } from "@/components/status/RepostStatusModal";
import { dateDayKey } from "@flowdesk/firebase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { panelHref } from "@/lib/business-nav";

const STATUS_LABEL: Record<ScheduledStatus["status"], string> = {
  scheduled: "Agendado",
  publishing: "Publicando…",
  published: "Enviado ao WhatsApp",
  failed: "Falhou",
  cancelled: "Cancelado",
};

function defaultSchedule(): Date {
  const d = new Date(Date.now() + 15 * 60_000);
  d.setSeconds(0, 0);
  return d;
}

export default function StatusSchedulePage() {
  const businessId = useBusinessId();
  const { ready, uid } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [publishNow, setPublishNow] = useState(false);

  const initialSchedule = useMemo(() => defaultSchedule(), []);
  const [selectedDayKeys, setSelectedDayKeys] = useState<string[]>(() => [
    dateDayKey(initialSchedule),
  ]);
  const [recurrenceMode, setRecurrenceMode] = useState<RecurrenceMode>("none");
  const [recurrenceIntervalDays, setRecurrenceIntervalDays] = useState<number>(1);
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>([
    initialSchedule.getDay(),
  ]);
  const [recurrenceStartDayKey, setRecurrenceStartDayKey] = useState<string>(
    dateDayKey(initialSchedule),
  );
  const [selectedHour, setSelectedHour] = useState<number>(() => initialSchedule.getHours());
  const [selectedMinute, setSelectedMinute] = useState<number>(() => initialSchedule.getMinutes());
  const mountedAt = useMemo(() => new Date(), []);

  const { connectedStable } = useSyncWhatsAppBusiness(businessId);

  const { data: business } = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => businessApi.get(businessId),
    enabled: !!businessId && ready && !!uid,
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["scheduled-status", businessId, uid],
    queryFn: () => scheduledStatusApi.list(businessId),
    enabled: ready && !!uid && !!businessId,
    refetchInterval: 20_000,
  });

  const { data: tenant } = useQuery({
    queryKey: ["tenant", uid],
    queryFn: () => tenantApi.get(),
    enabled: ready && !!uid,
  });

  const { data: storiesPublished = 0 } = useQuery({
    queryKey: ["tenant-stories-published", uid],
    queryFn: () => getClientTenantStoriesPublished(uid!),
    enabled: ready && !!uid,
    refetchInterval: 20_000,
  });

  const plan = (tenant?.plan ?? "STARTER") as PlanTier;
  const storiesLimit = PLAN_LIMITS[plan].scheduledStoriesPerMonth;
  const storiesUsed = storiesPublished;
  const storiesLeft = Number.isFinite(storiesLimit)
    ? Math.max(0, storiesLimit - storiesUsed)
    : Infinity;
  const atStoriesLimit = Number.isFinite(storiesLimit) && storiesLeft === 0;

  const createMutation = useMutation({
    retry: false,
    mutationFn: async () => {
      if (submittingRef.current) throw new Error("Agendamento em andamento.");
      submittingRef.current = true;
      try {
      if (!file) throw new Error("Selecione uma imagem ou vídeo.");
      if (atStoriesLimit) {
        throw new Error(
          `Seu plano permite ${storiesLimit} publicações de stories por mês e você já atingiu o limite.`,
        );
      }
      if (!publishNow && selectedDayKeys.length === 0) {
        throw new Error("Selecione pelo menos um dia no calendário.");
      }
      return scheduledStatusApi.create(businessId, {
        file,
        caption: caption.trim() || undefined,
        publishNow,
        scheduledDays: selectedDayKeys,
        hour: selectedHour,
        minute: selectedMinute,
      });
      } finally {
        submittingRef.current = false;
      }
    },
    onSuccess: (rows) => {
      void queryClient.invalidateQueries({ queryKey: ["scheduled-status", businessId] });
      void queryClient.invalidateQueries({ queryKey: ["tenant-stories-published", uid] });
      setFile(null);
      setPreview(null);
      setCaption("");
      setPublishNow(false);
      const next = defaultSchedule();
      setSelectedDayKeys([dateDayKey(next)]);
      setRecurrenceMode("none");
      setRecurrenceIntervalDays(1);
      setRecurrenceWeekdays([next.getDay()]);
      setRecurrenceStartDayKey(dateDayKey(next));
      setSelectedHour(next.getHours());
      setSelectedMinute(next.getMinutes());
      if (fileRef.current) fileRef.current.value = "";
      toast.success(
        publishNow
          ? "Story enfileirado para publicação imediata!"
          : rows.length > 1
            ? `${rows.length} stories agendados!`
            : "Status agendado!",
      );
    },
    onError: (err: Error) => toast.error(err.message ?? "Erro ao agendar"),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id }: { id: string; published?: boolean }) =>
      scheduledStatusApi.cancel(businessId, id),
    onSuccess: (_, { published }) => {
      void queryClient.invalidateQueries({ queryKey: ["scheduled-status", businessId] });
      toast.success(published ? "Story apagado do WhatsApp" : "Agendamento cancelado");
    },
    onError: (err: Error) => toast.error(err.message ?? "Erro ao apagar"),
  });

  const cancelSeriesMutation = useMutation({
    mutationFn: (seriesId: string) => scheduledStatusApi.cancelSeries(businessId, seriesId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["scheduled-status", businessId] });
      toast.success("Série cancelada");
    },
    onError: (err: Error) => toast.error(err.message ?? "Erro ao cancelar série"),
  });

  const pending = useMemo(() => items.filter((i) => i.status === "scheduled"), [items]);
  const history = useMemo(() => items.filter((i) => i.status !== "scheduled"), [items]);

  const seriesPendingCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of pending) {
      if (!i.seriesId) continue;
      m.set(i.seriesId, (m.get(i.seriesId) ?? 0) + 1);
    }
    return m;
  }, [pending]);

  const duplicateScheduleSlots = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of pending) {
      counts.set(i.scheduledAt, (counts.get(i.scheduledAt) ?? 0) + 1);
    }
    return [...counts.entries()].filter(([, n]) => n > 1);
  }, [pending]);

  function onPickFile(f: File | null) {
    setFile(f);
    if (preview) URL.revokeObjectURL(preview);
    if (!f) { setPreview(null); return; }
    setPreview(URL.createObjectURL(f));
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-brand-500 to-teal-500 p-6 mb-8 shadow-lg">
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
            <CircleDot className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Stories do WhatsApp</h1>
            <p className="text-white/75 text-sm mt-0.5">
              Agende imagens e vídeos para publicar no status do WhatsApp
            </p>
            <p className="text-white/60 text-xs mt-1 max-w-xl">
              Publicação via WhatsApp Web: pode aparecer primeiro no computador vinculado. Quem já conversou com seu número vê no celular; confira privacidade de status no app.
            </p>
          </div>
        </div>
      </div>

      {Number.isFinite(storiesLimit) && (
        <div
          className={cn(
            "flex items-start gap-3 mb-6 px-4 py-3 rounded-2xl border",
            storiesLeft === 0
              ? "bg-amber-50 border-amber-200"
              : "bg-brand-50/50 border-brand-100",
          )}
        >
          <CircleDot className="w-5 h-5 text-brand-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-800">
            Stories publicados este mês: <strong>{storiesUsed}</strong> de{" "}
            <strong>{formatPlanLimit(storiesLimit)}</strong> do plano.
            {storiesLeft > 0 ? (
              <> Restam <strong>{storiesLeft}</strong> publicação{storiesLeft === 1 ? "" : "ões"} com sucesso.</>
            ) : (
              <> Limite atingido — faça upgrade em Meu plano.</>
            )}
          </p>
        </div>
      )}

      {!connectedStable && (
        <div className="flex items-start gap-3 mb-6 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <p className="font-medium">WhatsApp precisa estar conectado na hora da publicação.</p>
            <Link
              href={panelHref(businessId, "whatsapp")}
              className="text-brand-700 underline mt-1 inline-block"
            >
              Ir para conexão WhatsApp
            </Link>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 mb-8 shadow-sm">
        <h2 className="font-semibold text-gray-900 mb-5">Novo agendamento</h2>
        <div className="space-y-5">

          {/* File picker */}
          <div>
            <Label className="mb-2 block">Arte (JPEG, PNG ou vídeo MP4 — WebP vira JPEG ao enviar)</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-brand-300 hover:bg-brand-50/30 transition-colors"
            >
              {preview ? (
                file?.type.startsWith("video/") ? (
                  <video src={preview} className="max-h-48 rounded-lg" controls />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="" className="max-h-48 rounded-lg object-contain" />
                )
              ) : (
                <>
                  <Upload className="w-8 h-8 text-gray-400" />
                  <span className="text-sm text-gray-600">Toque para escolher arquivo</span>
                </>
              )}
            </button>
          </div>

          {/* Caption */}
          <div>
            <Label htmlFor="caption">Legenda (opcional)</Label>
            <Textarea
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={700}
              rows={2}
              className="mt-1.5"
              placeholder="Texto que aparece no status"
            />
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 rounded border-brand-300 text-brand-600 focus:ring-brand-500"
              checked={publishNow}
              onChange={(e) => setPublishNow(e.target.checked)}
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
            <>
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
            </>
          )}

          <p className="text-xs text-gray-500">
            {publishNow
              ? "A publicação entra na fila assim que você confirmar. Mantenha o agente WhatsApp online."
              : "O status será publicado pela conta WhatsApp conectada. A visibilidade segue a privacidade do seu WhatsApp. Mantenha o agente online no horário agendado."}
          </p>
          <p className="text-xs text-gray-500 leading-relaxed rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
            Para conferir a arte: use &quot;Abrir prévia da arte&quot; no histórico após publicar,
            ou no celular abra a aba <strong className="font-medium text-gray-700">Atualizações</strong>{" "}
            (não só o círculo do perfil). Às vezes o app mostra &quot;aguardando atualização&quot; por
            alguns minutos mesmo com o status no ar — isso é normal ao publicar pela API.
            No <strong className="font-medium text-gray-700">iPhone</strong>, deixe o WhatsApp aberto no celular
            por 1–2 min após o horário agendado; se aparecer &quot;Aguardando a atualização de status&quot;, feche e
            reabra o app ou toque em &quot;Saiba mais&quot; e aguarde a sincronização com o dispositivo vinculado.
            Status publicados pela API não somem ao apagar no celular — use &quot;Apagar do WhatsApp&quot; no histórico.
            Stories antigos (antes desta atualização) somem sozinhos em até 24h. Cancele na fila antes do horário se desistir.
          </p>

          <Button
            className="w-full"
            disabled={
              !file ||
              createMutation.isPending ||
              (!publishNow && selectedDayKeys.length === 0) ||
              atStoriesLimit
            }
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : publishNow ? (
              <Zap className="w-4 h-4 mr-2" />
            ) : (
              <CalendarClock className="w-4 h-4 mr-2" />
            )}
            {publishNow ? "Publicar agora" : "Agendar publicação"}
          </Button>
        </div>
      </div>

      {/* Pending queue */}
      <section className="mb-8">
        <h2 className="font-semibold text-gray-900 mb-3">Na fila ({pending.length})</h2>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
          </div>
        ) : pending.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center rounded-xl bg-gray-50">
            Nenhum status agendado.
          </p>
        ) : (
          <>
            {duplicateScheduleSlots.length > 0 && (
              <div className="flex items-start gap-3 mb-3 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-900">
                  Há {duplicateScheduleSlots.length} horário(s) com mais de um story na fila.
                  O WhatsApp não lida bem com dois status no mesmo minuto — o segundo pode falhar ou
                  ficar estranho no celular. Espaçe em <strong>2–3 minutos</strong> ou cancele um.
                </p>
              </div>
            )}
          <ul className="space-y-3">
            {pending.map((row) => (
              <StatusRow
                key={row.id}
                row={row}
                businessId={businessId}
                businessName={business?.name ?? ""}
                seriesPendingCount={row.seriesId ? seriesPendingCount.get(row.seriesId) : undefined}
                onCancel={() => deleteMutation.mutate({ id: row.id })}
                onCancelSeries={
                  row.seriesId && (seriesPendingCount.get(row.seriesId) ?? 0) > 1
                    ? () => cancelSeriesMutation.mutate(row.seriesId!)
                    : undefined
                }
                deleting={deleteMutation.isPending || cancelSeriesMutation.isPending}
                onReposted={() =>
                  void queryClient.invalidateQueries({ queryKey: ["scheduled-status", businessId] })
                }
              />
            ))}
          </ul>
          </>
        )}
      </section>

      {history.length > 0 && (
        <section>
          <h2 className="font-semibold text-gray-900 mb-3">Histórico</h2>
          <ul className="space-y-3">
            {history.map((row) => (
              <StatusRow
                key={row.id}
                row={row}
                businessId={businessId}
                businessName={business?.name ?? ""}
                onRevoke={
                  row.status === "published"
                    ? () => deleteMutation.mutate({ id: row.id, published: true })
                    : undefined
                }
                deleting={deleteMutation.isPending}
                onReposted={() =>
                  void queryClient.invalidateQueries({ queryKey: ["scheduled-status", businessId] })
                }
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const REPOSTABLE: ScheduledStatus["status"][] = ["published", "failed", "cancelled"];

function StatusRow({
  row,
  businessId,
  businessName = "",
  seriesPendingCount,
  onCancel,
  onCancelSeries,
  onRevoke,
  deleting,
  onReposted,
}: {
  row: ScheduledStatus;
  businessId: string;
  businessName?: string;
  seriesPendingCount?: number;
  onCancel?: () => void;
  onCancelSeries?: () => void;
  onRevoke?: () => void;
  deleting?: boolean;
  onReposted?: () => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [repostOpen, setRepostOpen] = useState(false);
  const when = format(new Date(row.scheduledAt), "dd/MM/yyyy HH:mm", { locale: ptBR });
  const isVideo = row.mediaType === "video";
  const canRepost = REPOSTABLE.includes(row.status);

  return (
    <li className="flex gap-3 p-3 rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {row.mediaUrl && !isVideo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.mediaUrl} alt="" className="w-full h-full object-cover" />
        ) : isVideo ? (
          <Video className="w-6 h-6 text-gray-500" />
        ) : (
          <ImageIcon className="w-6 h-6 text-gray-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={row.status} />
          <span className="text-xs text-gray-500">{when}</span>
        </div>
        {row.caption && (
          <p className="text-sm text-gray-700 mt-1 truncate">{row.caption}</p>
        )}
        {row.error && (
          <p className="text-xs text-red-600 mt-1">{row.error}</p>
        )}
        {seriesPendingCount != null && seriesPendingCount > 1 && (
          <p className="text-xs text-brand-700 mt-1">Série · {seriesPendingCount} na fila</p>
        )}
        {row.sourceStatusId && row.status === "scheduled" && (
          <p className="text-xs text-gray-500 mt-0.5">Republicação agendada</p>
        )}
        {(canRepost || (row.status === "published" && (row.mediaUrl || onRevoke))) && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2.5 pt-2.5 border-t border-gray-100">
            {canRepost && (
              <button
                type="button"
                onClick={() => setRepostOpen(true)}
                className="text-xs font-medium text-brand-700 hover:text-brand-900 inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50/80 px-2.5 py-1.5 hover:bg-brand-100 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 flex-shrink-0" />
                Reagendar / repetir
              </button>
            )}
            {row.status === "published" && row.mediaUrl && (
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="text-xs font-medium text-gray-700 hover:text-gray-900 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 hover:bg-gray-100 transition-colors"
              >
                <Play className="w-3.5 h-3.5 flex-shrink-0" />
                Ver prévia no WhatsApp
              </button>
            )}
            {onRevoke && row.status === "published" && (
              <button
                type="button"
                onClick={onRevoke}
                disabled={deleting}
                className="text-xs font-medium text-red-700 hover:text-red-900 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
                Apagar do WhatsApp
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 flex-shrink-0">
        {onCancelSeries && row.status === "scheduled" && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-red-600 hover:text-red-700 h-8 px-2"
            disabled={deleting}
            onClick={onCancelSeries}
          >
            Cancelar série
          </Button>
        )}
        {onCancel && row.status === "scheduled" && (
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-red-600"
            disabled={deleting}
            onClick={onCancel}
            aria-label="Cancelar"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {repostOpen && (
        <RepostStatusModal
          businessId={businessId}
          row={row}
          onClose={() => setRepostOpen(false)}
          onScheduled={() => onReposted?.()}
        />
      )}

      {previewOpen && (
        <StoryPreviewModal
          row={row}
          businessName={businessName}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </li>
  );
}

function StoryPreviewModal({
  row,
  businessName,
  onClose,
}: {
  row: ScheduledStatus;
  businessName: string;
  onClose: () => void;
}) {
  const [reply, setReply] = useState("");
  const [sent, setSent] = useState(false);
  const isVideo = row.mediaType === "video";
  const initials = businessName.trim()
    .split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

  function handleSend() {
    if (!reply.trim()) return;
    setSent(true);
    setReply("");
    setTimeout(() => setSent(false), 2500);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      {/* Phone frame */}
      <div
        className="relative bg-black rounded-[2rem] overflow-hidden shadow-2xl ring-1 ring-white/10 flex-shrink-0"
        style={{ width: 300, maxHeight: "85vh", aspectRatio: "9/16" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div className="absolute top-4 inset-x-4 z-30">
          <div className="h-[3px] rounded-full bg-white/25 overflow-hidden">
            <div className="h-full w-2/5 rounded-full bg-white" />
          </div>
        </div>

        {/* Header */}
        <div className="absolute top-9 inset-x-0 z-30 flex items-center gap-2.5 px-4">
          <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ring-2 ring-white/25">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold leading-tight truncate">
              {businessName || "Meu negócio"}
            </p>
            <p className="text-white/60 text-[10px] leading-none mt-0.5">agora</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Media — fills the frame */}
        <div className="absolute inset-0 bg-gray-900">
          {row.mediaUrl && (
            isVideo ? (
              <video
                src={row.mediaUrl}
                className="w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.mediaUrl} alt="" className="w-full h-full object-cover" />
            )
          )}
        </div>

        {/* Caption + Reply bar — WhatsApp style */}
        <div className="absolute bottom-0 inset-x-0 z-30 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-4 pt-10 pb-5 flex flex-col gap-3">
          {row.caption && (
            <p className="text-white text-sm leading-relaxed text-center font-medium drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
              {row.caption}
            </p>
          )}
          {sent ? (
            <div className="flex items-center justify-center gap-1.5 py-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#4FC3F7]" />
              <span className="text-white/90 text-xs font-medium">Mensagem enviada!</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-full pl-4 pr-2 py-2">
              <input
                type="text"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                placeholder={`Responder a ${businessName || "negócio"}...`}
                className="flex-1 bg-transparent text-white text-xs placeholder:text-white/45 outline-none min-w-0"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleSend(); }}
                disabled={!reply.trim()}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
                  reply.trim()
                    ? "bg-[#00A884] text-white shadow-md"
                    : "text-white/40"
                )}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/35 text-[11px] pointer-events-none select-none">
        Toque fora para fechar
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: ScheduledStatus["status"] }) {
  const styles: Record<ScheduledStatus["status"], string> = {
    scheduled: "bg-blue-50 text-blue-700",
    publishing: "bg-amber-50 text-amber-700",
    published: "bg-emerald-50 text-emerald-700",
    failed: "bg-red-50 text-red-700",
    cancelled: "bg-gray-100 text-gray-600",
  };
  const Icon =
    status === "published"
      ? CheckCircle2
      : status === "failed"
        ? XCircle
        : CircleDot;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full",
        styles[status]
      )}
    >
      <Icon className="w-3 h-3" />
      {STATUS_LABEL[status]}
    </span>
  );
}

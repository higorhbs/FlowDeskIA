"use client";

import React, { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  APP_DISPLAY_NAME,
  PLAN_LIMITS,
  formatPlanLimit,
  type PlanTier,
} from "@flowdesk/shared";
import { scheduledStatusApi, businessApi, tenantApi } from "@/lib/api";
import { webApi } from "@/lib/web-api";
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
  AlertTriangle,
  Clock,
  History,
  HelpCircle,
  X,
  Smartphone,
  Eye,
  Trash2,
  Wifi,
} from "lucide-react";
import { StatusMultiDayPicker } from "@/components/status/StatusMultiDayPicker";
import {
  RecurrenceMode,
  StatusRecurrenceControls,
} from "@/components/status/StatusRecurrenceControls";
import { groupByMonthDayScheduled } from "@/components/status/status-day-groups";
import { StatusHistoryCarousel } from "@/components/status/StatusHistoryCarousel";
import { StatusHistoryFolders } from "@/components/status/StatusHistoryFolders";
import { dateDayKey } from "@flowdesk/firebase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { panelHref } from "@/lib/business-nav";

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
  const [helpOpen, setHelpOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"agendar" | "fila" | "historico">("agendar");

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
    queryFn: () => webApi.tenants.getStoriesPublished(),
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
      setActiveTab(publishNow ? "historico" : "fila");
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

  const pending = useMemo(
    () =>
      items
        .filter((i) => i.status === "scheduled")
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
    [items],
  );
  const pendingByMonth = useMemo(() => groupByMonthDayScheduled(pending, "asc"), [pending]);
  const history = useMemo(
    () =>
      items
        .filter((i) => i.status !== "scheduled")
        .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)),
    [items],
  );
  const historyByMonth = useMemo(() => groupByMonthDayScheduled(history, "desc"), [history]);

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
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-brand-500 to-teal-500 p-5 mb-5 shadow-lg">
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <CircleDot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">Stories do WhatsApp</h1>
            <p className="text-white/70 text-xs mt-0.5">
              Agende imagens e vídeos para publicar no status
            </p>
          </div>
        </div>
      </div>

      {/* Alerts — always visible */}
      {!connectedStable && (
        <div className="flex items-start gap-3 mb-4 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <span className="font-semibold">WhatsApp desconectado.</span>{" "}
            <Link href={panelHref(businessId, "whatsapp")} className="underline">
              Conectar agora
            </Link>
          </div>
        </div>
      )}

      {Number.isFinite(storiesLimit) && (
        <div
          className={cn(
            "flex items-center gap-2.5 mb-4 px-4 py-2.5 rounded-2xl border",
            storiesLeft === 0 ? "bg-amber-50 border-amber-200" : "bg-brand-50/50 border-brand-100",
          )}
        >
          <CircleDot className="w-4 h-4 text-brand-600 shrink-0" />
          <p className="text-xs text-gray-700">
            <strong>{storiesUsed}</strong> de <strong>{formatPlanLimit(storiesLimit)}</strong> stories usados este mês.
            {storiesLeft === 0 ? (
              <span className="text-amber-700 font-semibold"> Limite atingido.</span>
            ) : (
              <span className="text-gray-500"> Restam {storiesLeft}.</span>
            )}
          </p>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex bg-gray-100/80 rounded-2xl p-1 mb-6 gap-1">
        <TabBtn
          active={activeTab === "agendar"}
          onClick={() => setActiveTab("agendar")}
          icon={<CalendarClock className="w-4 h-4" />}
        >
          Agendar
        </TabBtn>
        <TabBtn
          active={activeTab === "fila"}
          onClick={() => setActiveTab("fila")}
          icon={<Clock className="w-4 h-4" />}
          count={pending.length}
        >
          Na fila
        </TabBtn>
        <TabBtn
          active={activeTab === "historico"}
          onClick={() => setActiveTab("historico")}
          icon={<History className="w-4 h-4" />}
          count={history.length}
        >
          Histórico
        </TabBtn>
      </div>

      {/* ── Tab: Agendar ── */}
      {activeTab === "agendar" && (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="space-y-5">
            {/* File picker */}
            <div>
              <Label className="mb-2 block">Arte (JPEG, PNG ou vídeo MP4)</Label>
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
                    <span className="text-sm text-gray-500">Toque para escolher arquivo</span>
                    <span className="text-xs text-gray-400">WebP é convertido para JPEG</span>
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

            {/* Publish now toggle */}
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
                <span className="block text-xs text-gray-500 mt-0.5">
                  Envia em alguns segundos (WhatsApp precisa estar conectado).
                </span>
              </span>
            </label>

            {/* Date + time picker */}
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
      )}

      {/* ── Tab: Na fila ── */}
      {activeTab === "fila" && (
        <section>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
            </div>
          ) : pending.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 rounded-2xl bg-gray-50 border border-gray-100 border-dashed">
              <Clock className="w-10 h-10 text-gray-300" />
              <p className="text-sm text-gray-400 font-medium">Nenhum story agendado</p>
              <button
                type="button"
                onClick={() => setActiveTab("agendar")}
                className="text-xs text-brand-600 font-semibold hover:underline"
              >
                Criar agendamento →
              </button>
            </div>
          ) : (
            <>
              {duplicateScheduleSlots.length > 0 && (
                <div className="flex items-start gap-3 mb-4 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-900">
                    {duplicateScheduleSlots.length} horário(s) com mais de um story — o segundo pode falhar.
                    Espaçe em <strong>2–3 min</strong> ou cancele um.
                  </p>
                </div>
              )}
              <StatusHistoryFolders
                groups={pendingByMonth}
                openFirstDay
                renderDay={(_, rows) => (
                  <StatusHistoryCarousel
                    variant="queue"
                    items={rows}
                    businessId={businessId}
                    businessName={business?.name ?? ""}
                    seriesPendingCount={seriesPendingCount}
                    deleting={deleteMutation.isPending || cancelSeriesMutation.isPending}
                    onCancel={(row) => deleteMutation.mutate({ id: row.id })}
                    onCancelSeries={(seriesId) => cancelSeriesMutation.mutate(seriesId)}
                    onReposted={() =>
                      void queryClient.invalidateQueries({
                        queryKey: ["scheduled-status", businessId],
                      })
                    }
                  />
                )}
              />
            </>
          )}
        </section>
      )}

      {/* ── Tab: Histórico ── */}
      {activeTab === "historico" && (
        <section>
          {history.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 rounded-2xl bg-gray-50 border border-gray-100 border-dashed">
              <History className="w-10 h-10 text-gray-300" />
              <p className="text-sm text-gray-400 font-medium">Nenhum story publicado ainda</p>
            </div>
          ) : (
            <StatusHistoryFolders
              groups={historyByMonth}
              renderDay={(_, rows) => (
                <StatusHistoryCarousel
                  items={rows}
                  businessId={businessId}
                  businessName={business?.name ?? ""}
                  deleting={deleteMutation.isPending}
                  onRevoke={(row) => deleteMutation.mutate({ id: row.id, published: true })}
                  onReposted={() =>
                    void queryClient.invalidateQueries({ queryKey: ["scheduled-status", businessId] })
                  }
                />
              )}
            />
          )}
        </section>
      )}

      {/* Floating help button */}
      <button
        type="button"
        onClick={() => setHelpOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-brand-600 text-white shadow-lg shadow-brand-400/40 flex items-center justify-center hover:bg-brand-700 hover:scale-110 active:scale-95 transition-all duration-200"
        aria-label="Ajuda"
      >
        <HelpCircle className="w-5 h-5" />
      </button>

      {/* Help modal */}
      {helpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center">
                  <HelpCircle className="w-4 h-4 text-brand-600" />
                </div>
                <span className="font-bold text-gray-900">Dúvidas frequentes</span>
              </div>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <HelpItem icon={<Wifi className="w-4 h-4 text-brand-600" />} title="Quando o story aparece?">
                O status é publicado pela conta WhatsApp conectada. Mantenha o agente online no horário agendado. A visibilidade segue a privacidade do seu WhatsApp.
              </HelpItem>
              <HelpItem icon={<Eye className="w-4 h-4 text-brand-600" />} title="Como ver a arte publicada?">
                No histórico, toque em <strong className="font-semibold">"Prévia"</strong>. No celular, abra a aba <strong className="font-semibold">Atualizações</strong> — não só o círculo do perfil.
              </HelpItem>
              <HelpItem icon={<Smartphone className="w-4 h-4 text-brand-600" />} title="No iPhone o status não aparece?">
                Deixe o WhatsApp aberto por 1–2 min após o horário. Se aparecer "Aguardando", feche e reabra o app.
              </HelpItem>
              <HelpItem icon={<Trash2 className="w-4 h-4 text-brand-600" />} title="Como apagar um story publicado?">
                Use <strong className="font-semibold">"Apagar do WhatsApp"</strong> no histórico — apagar pelo celular não funciona para stories publicados via API.
              </HelpItem>
              <HelpItem icon={<CalendarClock className="w-4 h-4 text-brand-600" />} title="Posso cancelar um agendamento?">
                Sim. Vá para a aba <strong className="font-semibold">Na fila</strong>, selecione o dia e cancele antes do horário.
              </HelpItem>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-sm font-semibold transition-all duration-200",
        active
          ? "bg-white text-gray-900 shadow-sm"
          : "text-gray-500 hover:text-gray-700",
      )}
    >
      <span className={cn("transition-colors", active ? "text-brand-600" : "text-gray-400")}>
        {icon}
      </span>
      <span className="hidden xs:inline sm:inline">{children}</span>
      {count !== undefined && count > 0 && (
        <span
          className={cn(
            "text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full leading-none",
            active ? "bg-brand-100 text-brand-700" : "bg-gray-200 text-gray-500",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function HelpItem({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-xl bg-brand-50 flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-900 mb-0.5">{title}</p>
        <p className="text-sm text-gray-500 leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

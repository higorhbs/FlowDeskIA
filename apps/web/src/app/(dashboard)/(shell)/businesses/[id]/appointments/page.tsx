"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { appointmentApi, businessApi, catalogApi, whatsappApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format, startOfWeek, endOfWeek, addWeeks, eachDayOfInterval, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  CalendarDays,
  CalendarRange,
  Loader2,
  Check,
  X,
  FileText,
  Send,
  Smartphone,
  Pencil,
  Plus,
  Trash2,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBusinessId } from "@/lib/use-business-id";
import { useBusinessVocabulary } from "@/lib/use-business-vocabulary";
import { getBookingStatusLabel, businessRequiresBookingApproval } from "@flowdesk/shared";
import { toast } from "sonner";
import { VocabLabel } from "@/components/layout/VocabLabel";

const STATUS_ORDER = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;

const STATUS_META: Record<string, { dot: string; card: string; badge: string }> = {
  PENDING: {
    dot: "bg-orange-500",
    card: "border-orange-200 bg-orange-50 hover:border-orange-300 hover:shadow-orange-100",
    badge: "bg-orange-100 text-orange-700",
  },
  CONFIRMED: {
    dot: "bg-green-500",
    card: "border-green-200 bg-white hover:border-green-300 hover:shadow-green-100",
    badge: "bg-green-100 text-green-700",
  },
  CANCELLED: {
    dot: "bg-red-400",
    card: "border-red-100 bg-red-50/60 opacity-70 hover:opacity-100",
    badge: "bg-red-100 text-red-600",
  },
  COMPLETED: {
    dot: "bg-purple-500",
    card: "border-purple-200 bg-white hover:border-purple-300 hover:shadow-purple-100",
    badge: "bg-purple-100 text-purple-700",
  },
  NO_SHOW: {
    dot: "bg-gray-400",
    card: "border-gray-200 bg-gray-50 opacity-70 hover:opacity-100",
    badge: "bg-gray-100 text-gray-600",
  },
};

type Apt = {
  id: string;
  customerName?: string;
  customerPhone: string;
  serviceName: string;
  scheduledAt: string;
  durationMins?: number;
  notes?: string;
  status: string;
};

type EditForm = {
  customerName: string;
  serviceName: string;
  date: string;
  time: string;
  durationMins: string;
  notes: string;
  status: string;
};

function toEditForm(apt: Apt): EditForm {
  const when = new Date(apt.scheduledAt);
  return {
    customerName: apt.customerName ?? "",
    serviceName: apt.serviceName,
    date: format(when, "yyyy-MM-dd"),
    time: format(when, "HH:mm"),
    durationMins: String(apt.durationMins ?? 60),
    notes: apt.notes ?? "",
    status: apt.status,
  };
}

export default function AppointmentsPage() {
  const businessId = useBusinessId();
  const v = useBusinessVocabulary();
  const queryClient = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<"day" | "week" | "month">("day");

  const [editing, setEditing] = useState<{ apt: Apt; form: EditForm } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Apt | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const draggedIdRef = useRef<string | null>(null);

  const emptyCreateForm: EditForm & { customerPhone: string; serviceId: string } = {
    customerName: "",
    customerPhone: "",
    serviceName: "",
    serviceId: "",
    date: format(new Date(), "yyyy-MM-dd"),
    time: "09:00",
    durationMins: "60",
    notes: "",
    status: "CONFIRMED",
  };
  const [creating, setCreating] = useState<typeof emptyCreateForm | null>(null);
  const canCreate = v.businessType === "BARBERSHOP";

  const { data: business } = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => businessApi.get(businessId),
    enabled: !!businessId,
  });

  const needsBookingApproval = businessRequiresBookingApproval(
    business?.type ?? v.businessType,
    (business as { appointmentBot?: { requiresApproval?: boolean } } | undefined)?.appointmentBot,
  );

  const { data: catalog = [] } = useQuery({
    queryKey: ["catalog", businessId],
    queryFn: () => catalogApi.list(businessId),
    enabled: !!businessId && canCreate,
  });
  const services = (catalog as { id: string; name: string; price: number; available: boolean }[]).filter(
    (c) => c.available,
  );

  const createMutation = useMutation({
    mutationFn: (form: typeof emptyCreateForm) => {
      const scheduledAt = new Date(`${form.date}T${form.time}`);
      if (Number.isNaN(scheduledAt.getTime())) throw new Error("Data ou hora inválida");
      return appointmentApi.create(businessId, {
        customerName: form.customerName.trim() || undefined,
        customerPhone: form.customerPhone.trim() || undefined,
        serviceId: form.serviceId || undefined,
        serviceName: form.serviceName.trim(),
        scheduledAt: scheduledAt.toISOString(),
        durationMins: Number(form.durationMins) || 60,
        status: form.status as never,
        notes: form.notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments", businessId] });
      queryClient.invalidateQueries({ queryKey: ["appointments-pending", businessId] });
      toast.success(`${v.bookingSingular} criado`);
      setCreating(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao criar agendamento"),
  });

  function updateCreateForm(patch: Partial<typeof emptyCreateForm>) {
    setCreating((cur) => (cur ? { ...cur, ...patch } : cur));
  }

  const reportMutation = useMutation({
    mutationFn: (period: "day" | "week" | "month") => whatsappApi.sendReport(businessId, period),
    onSuccess: () => {
      toast.success("Relatório enviado no seu WhatsApp");
      setReportOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao enviar relatório"),
  });

  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments", businessId, weekOffset],
    queryFn: () =>
      appointmentApi.list(businessId, {
        from: weekStart.toISOString(),
        to: weekEnd.toISOString(),
      }),
  });

  const { data: allPending = [] } = useQuery({
    queryKey: ["appointments-pending", businessId],
    queryFn: () => appointmentApi.list(businessId, { status: "PENDING" }),
    enabled: needsBookingApproval,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      appointmentApi.patch(businessId, id, data),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["appointments", businessId] });
      queryClient.invalidateQueries({ queryKey: ["appointments-pending", businessId] });
      if (vars.data.status === "CONFIRMED") {
        whatsappApi
          .sendAppointmentConfirmation(businessId, vars.id)
          .then((r) => {
            if (!r?.skipped) toast.success("Cliente avisado no WhatsApp");
          })
          .catch(() => undefined);
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  const pending = needsBookingApproval
    ? (allPending as Apt[])
    : (appointments as Apt[]).filter((a) => a.status === "PENDING");
  const bizType = v.businessType;

  function appointmentsForDay(day: Date) {
    return (appointments as Apt[])
      .filter((a) => isSameDay(new Date(a.scheduledAt), day))
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }

  function openEdit(apt: Apt) {
    setEditing({ apt, form: toEditForm(apt) });
  }

  function updateEditForm(patch: Partial<EditForm>) {
    setEditing((cur) => (cur ? { ...cur, form: { ...cur.form, ...patch } } : cur));
  }

  function saveEdit() {
    if (!editing) return;
    const { apt, form } = editing;
    const scheduledAt = new Date(`${form.date}T${form.time}`);
    if (Number.isNaN(scheduledAt.getTime())) {
      toast.error("Data ou hora inválida");
      return;
    }
    updateMutation.mutate(
      {
        id: apt.id,
        data: {
          customerName: form.customerName.trim() || undefined,
          serviceName: form.serviceName.trim(),
          scheduledAt: scheduledAt.toISOString(),
          durationMins: Number(form.durationMins) || 60,
          notes: form.notes.trim() || undefined,
          status: form.status,
        },
      },
      {
        onSuccess: () => {
          toast.success(`${v.bookingSingular} atualizado`);
          setEditing(null);
        },
      },
    );
  }

  function confirmCancel() {
    if (!cancelTarget) return;
    const id = cancelTarget.id;
    updateMutation.mutate(
      { id, data: { status: "CANCELLED" } },
      {
        onSuccess: () => {
          toast.success("Agendamento cancelado");
          setCancelTarget(null);
          setEditing((cur) => (cur && cur.apt.id === id ? null : cur));
        },
      },
    );
  }

  function handleDragStart(apt: Apt) {
    draggedIdRef.current = apt.id;
  }

  function handleDragEnd() {
    draggedIdRef.current = null;
    setDragOverDay(null);
  }

  function handleDragOverDay(e: React.DragEvent, dayKey: string) {
    if (!draggedIdRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverDay !== dayKey) setDragOverDay(dayKey);
  }

  function handleDrop(e: React.DragEvent, day: Date) {
    e.preventDefault();
    const id = draggedIdRef.current;
    draggedIdRef.current = null;
    setDragOverDay(null);
    if (!id) return;
    const apt = (appointments as Apt[]).find((a) => a.id === id);
    if (!apt) return;
    const original = new Date(apt.scheduledAt);
    if (isSameDay(original, day)) return;
    const next = new Date(day);
    next.setHours(original.getHours(), original.getMinutes(), original.getSeconds(), 0);
    updateMutation.mutate(
      { id, data: { scheduledAt: next.toISOString() } },
      {
        onSuccess: () => {
          toast.success(`Reagendado para ${format(next, "d 'de' MMM", { locale: ptBR })}`);
        },
      },
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            <VocabLabel ready={v.vocabReady} width="8rem" block>
              {v.bookingsPageTitle}
            </VocabLabel>
          </h1>
          <p className="text-gray-500 mt-1">
            {v.vocabReady ? (
              <>Gerencie os {v.bookingsPlural.toLowerCase()} feitos pelo WhatsApp</>
            ) : (
              <VocabLabel ready={false} width="18rem" block />
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canCreate && (
            <Button
              type="button"
              className="gap-1.5 bg-brand-600 hover:bg-brand-700 text-white"
              size="sm"
              onClick={() => setCreating(emptyCreateForm)}
            >
              <Plus className="w-4 h-4" />
              Novo
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            size="sm"
            onClick={() => setReportOpen(true)}
          >
            <FileText className="w-4 h-4" />
            Relatório
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={() => setWeekOffset((w) => w - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
            {format(weekStart, "d MMM", { locale: ptBR })} — {format(weekEnd, "d MMM yyyy", { locale: ptBR })}
          </span>
          <Button type="button" variant="outline" size="icon" onClick={() => setWeekOffset((w) => w + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button type="button" variant="outline" size="xs" onClick={() => setWeekOffset(0)}>Hoje</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-gray-500">
          {STATUS_ORDER.map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", STATUS_META[s]?.dot)} />
              {getBookingStatusLabel(bizType, s)}
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-400">Arraste um card para outro dia para reagendar · clique para editar</p>
      </div>

      {needsBookingApproval && pending.length > 0 && (
        <div className="mb-8 rounded-2xl border-2 border-orange-200 bg-orange-50/80 p-4 md:p-5">
          <h2 className="text-sm font-semibold text-orange-900 mb-3">{v.bookingPendingSectionTitle}</h2>
          <div className="space-y-3">
            {pending.map((apt) => {
              const when = new Date(apt.scheduledAt);
              return (
                <div
                  key={apt.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl bg-white border border-orange-200 p-4 shadow-sm cursor-pointer hover:border-orange-300 transition-colors"
                  onClick={() => openEdit(apt)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{apt.customerName ?? apt.customerPhone}</p>
                    <p className="text-sm text-gray-600 mt-0.5">
                      {format(when, "dd/MM/yyyy", { locale: ptBR })} às {format(when, "HH:mm")} · {apt.serviceName}
                    </p>
                    <span className="inline-block mt-2 text-xs font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                      {getBookingStatusLabel(bizType, apt.status)}
                    </span>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5 bg-green-600 hover:bg-green-700"
                      disabled={updateMutation.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateMutation.mutate(
                          { id: apt.id, data: { status: "CONFIRMED" } },
                          { onSuccess: () => toast.success(v.bookingStatusConfirmed) },
                        );
                      }}
                    >
                      <Check className="w-4 h-4" />
                      {v.bookingAcceptLabel}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-red-700 border-red-200 hover:bg-red-50"
                      disabled={updateMutation.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateMutation.mutate(
                          { id: apt.id, data: { status: "CANCELLED" } },
                          { onSuccess: () => toast.success("Recusado") },
                        );
                      }}
                    >
                      <X className="w-4 h-4" />
                      {v.bookingRejectLabel}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <div className="grid grid-cols-7 gap-3 min-w-[840px] md:min-w-0">
            {days.map((day) => {
              const dayKey = day.toISOString();
              const dayAppointments = appointmentsForDay(day);
              const isToday = isSameDay(day, new Date());
              const isDragOver = dragOverDay === dayKey;
              return (
                <div
                  key={dayKey}
                  className={cn(
                    "min-h-[200px] rounded-2xl transition-colors p-1 -m-1",
                    isDragOver && "bg-brand-50 ring-2 ring-brand-300",
                  )}
                  onDragOver={(e) => handleDragOverDay(e, dayKey)}
                  onDrop={(e) => handleDrop(e, day)}
                >
                  <div className={cn("text-center mb-2 py-2 rounded-lg", isToday ? "bg-brand-600 text-white" : "")}>
                    <p className={cn("text-xs font-medium", isToday ? "text-brand-100" : "text-gray-400")}>
                      {format(day, "EEE", { locale: ptBR }).toUpperCase()}
                    </p>
                    <p className={cn("text-lg font-bold", isToday ? "text-white" : "text-gray-900")}>
                      {format(day, "d")}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    {dayAppointments.map((apt) => {
                      const meta = STATUS_META[apt.status] ?? STATUS_META.CONFIRMED;
                      const isDraggable = apt.status === "PENDING" || apt.status === "CONFIRMED";
                      return (
                        <div
                          key={apt.id}
                          draggable={isDraggable}
                          onDragStart={() => handleDragStart(apt)}
                          onDragEnd={handleDragEnd}
                          onClick={() => openEdit(apt)}
                          className={cn(
                            "group relative border rounded-xl p-2.5 text-xs cursor-pointer transition-all hover:shadow-md",
                            meta.card,
                            isDraggable && "active:cursor-grabbing",
                          )}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div className="flex items-center gap-1 font-semibold">
                              {isDraggable && (
                                <GripVertical className="w-3 h-3 opacity-0 group-hover:opacity-40 -ml-0.5 flex-shrink-0" />
                              )}
                              {format(new Date(apt.scheduledAt), "HH:mm")}
                            </div>
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              <button
                                type="button"
                                title="Editar"
                                className="rounded p-0.5 hover:bg-black/10"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEdit(apt);
                                }}
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              {apt.status !== "CANCELLED" && (
                                <button
                                  type="button"
                                  title="Cancelar"
                                  className="rounded p-0.5 hover:bg-red-500/15 hover:text-red-700"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCancelTarget(apt);
                                  }}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="font-medium truncate mt-0.5">{apt.customerName ?? apt.customerPhone}</p>
                          <p className="truncate opacity-75">{apt.serviceName}</p>
                          <span
                            className={cn(
                              "inline-block mt-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium",
                              meta.badge,
                            )}
                          >
                            {getBookingStatusLabel(bizType, apt.status)}
                          </span>
                          {needsBookingApproval && apt.status === "PENDING" && (
                            <div className="flex gap-1 mt-2">
                              <Button
                                type="button"
                                size="xs"
                                className="flex-1 rounded-md bg-green-600 text-white py-1 text-[10px] font-semibold hover:bg-green-700 h-auto"
                                disabled={updateMutation.isPending}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateMutation.mutate(
                                    { id: apt.id, data: { status: "CONFIRMED" } },
                                    { onSuccess: () => toast.success(v.bookingStatusConfirmed) },
                                  );
                                }}
                              >
                                {v.bookingAcceptLabel}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                className="flex-1 rounded-md border-red-300 text-red-700 py-1 text-[10px] font-semibold hover:bg-red-50 h-auto"
                                disabled={updateMutation.isPending}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateMutation.mutate(
                                    { id: apt.id, data: { status: "CANCELLED" } },
                                    { onSuccess: () => toast.success("Recusado") },
                                  );
                                }}
                              >
                                {v.bookingRejectLabel}
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {dayAppointments.length === 0 && (
                      <div
                        className={cn(
                          "rounded-xl border-2 border-dashed py-5 text-center text-xs transition-colors",
                          isDragOver ? "border-brand-300 bg-brand-50 text-brand-500" : "border-gray-200 text-gray-300",
                        )}
                      >
                        <Calendar className="w-4 h-4 mx-auto mb-1 opacity-60" />
                        Livre
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => !updateMutation.isPending && setEditing(null)}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-gradient-to-br from-brand-600 to-brand-700 px-6 pt-6 pb-5">
              <button
                type="button"
                className="absolute right-4 top-4 rounded-full p-1 text-white/80 hover:bg-white/15 hover:text-white"
                onClick={() => !updateMutation.isPending && setEditing(null)}
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 border border-white/20">
                  <Pencil className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Editar agendamento</h2>
                  <p className="text-xs text-brand-100/90">{editing.apt.customerPhone}</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <Label className="mb-1.5">Nome do cliente</Label>
                <Input
                  value={editing.form.customerName}
                  onChange={(e) => updateEditForm({ customerName: e.target.value })}
                  placeholder={editing.apt.customerPhone}
                />
              </div>

              <div>
                <Label className="mb-1.5">Serviço</Label>
                <Input
                  value={editing.form.serviceName}
                  onChange={(e) => updateEditForm({ serviceName: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5">Data</Label>
                  <Input
                    type="date"
                    value={editing.form.date}
                    onChange={(e) => updateEditForm({ date: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="mb-1.5">Hora</Label>
                  <Input
                    type="time"
                    value={editing.form.time}
                    onChange={(e) => updateEditForm({ time: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label className="mb-1.5">Duração (minutos)</Label>
                <Input
                  type="number"
                  min={5}
                  step={5}
                  value={editing.form.durationMins}
                  onChange={(e) => updateEditForm({ durationMins: e.target.value })}
                />
              </div>

              <div>
                <Label className="mb-1.5">Status</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"].map((s) => {
                    const active = editing.form.status === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => updateEditForm({ status: s })}
                        className={cn(
                          "rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                          active
                            ? "border-brand-500 bg-brand-50 text-brand-700"
                            : "border-gray-200 text-gray-500 hover:border-brand-200 hover:bg-gray-50",
                        )}
                      >
                        {getBookingStatusLabel(bizType, s)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label className="mb-1.5">Observações</Label>
                <Textarea
                  value={editing.form.notes}
                  onChange={(e) => updateEditForm({ notes: e.target.value })}
                  placeholder="Notas internas sobre este agendamento"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 text-red-700 border-red-200 hover:bg-red-50"
                disabled={updateMutation.isPending}
                onClick={() => setCancelTarget(editing.apt)}
              >
                <Trash2 className="w-4 h-4" />
                Cancelar agendamento
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={updateMutation.isPending}>
                  Fechar
                </Button>
                <Button
                  type="button"
                  className="gap-1.5 bg-brand-600 hover:bg-brand-700 text-white"
                  disabled={updateMutation.isPending}
                  onClick={saveEdit}
                >
                  {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Salvar alterações
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {cancelTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => !updateMutation.isPending && setCancelTarget(null)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-gray-900">Cancelar agendamento?</h3>
                <p className="text-sm text-gray-500 truncate">
                  {cancelTarget.customerName ?? cancelTarget.customerPhone} ·{" "}
                  {format(new Date(cancelTarget.scheduledAt), "dd/MM 'às' HH:mm")}
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-5">Essa ação não pode ser desfeita.</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={updateMutation.isPending}
                onClick={() => setCancelTarget(null)}
              >
                Voltar
              </Button>
              <Button
                type="button"
                variant="destructiveSolid"
                className="flex-1 gap-1.5"
                disabled={updateMutation.isPending}
                onClick={confirmCancel}
              >
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Sim, cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {reportOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => !reportMutation.isPending && setReportOpen(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-gradient-to-br from-brand-600 to-brand-700 px-6 pt-6 pb-5">
              <button
                type="button"
                className="absolute right-4 top-4 rounded-full p-1 text-white/80 hover:bg-white/15 hover:text-white"
                onClick={() => !reportMutation.isPending && setReportOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 border border-white/20">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Enviar relatório</h2>
                  <p className="text-xs text-brand-100/90">Escolha o período do relatório</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5">
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-3">
                <Smartphone className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                <p className="text-xs leading-relaxed text-emerald-800">
                  O PDF será enviado para o número pessoal cadastrado nas configurações do negócio
                  {business?.phone ? (
                    <> (<span className="font-semibold">{business.phone}</span>)</>
                  ) : null}
                  .
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {([
                  { p: "day", label: "Hoje", icon: Calendar },
                  { p: "week", label: "Semana", icon: CalendarRange },
                  { p: "month", label: "Mês", icon: CalendarDays },
                ] as const).map((opt) => {
                  const active = reportPeriod === opt.p;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.p}
                      type="button"
                      onClick={() => setReportPeriod(opt.p)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-xl border-2 px-2 py-4 transition-all",
                        active
                          ? "border-brand-500 bg-brand-50 text-brand-700 shadow-sm"
                          : "border-gray-200 text-gray-500 hover:border-brand-200 hover:bg-gray-50",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-sm font-semibold">{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              <Button
                type="button"
                className="mt-5 w-full gap-2 bg-brand-600 hover:bg-brand-700 text-white"
                disabled={reportMutation.isPending}
                onClick={() => reportMutation.mutate(reportPeriod)}
              >
                {reportMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Enviar no meu WhatsApp
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {creating && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => !createMutation.isPending && setCreating(null)}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative bg-gradient-to-br from-brand-600 to-brand-700 px-6 pt-6 pb-5">
              <button
                type="button"
                className="absolute right-4 top-4 rounded-full p-1 text-white/80 hover:bg-white/15 hover:text-white"
                onClick={() => !createMutation.isPending && setCreating(null)}
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 border border-white/20">
                  <Plus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Novo agendamento</h2>
                  <p className="text-xs text-brand-100/90">Criar manualmente</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5">Nome do cliente</Label>
                  <Input
                    value={creating.customerName}
                    onChange={(e) => updateCreateForm({ customerName: e.target.value })}
                    placeholder="Ex.: João Silva"
                  />
                </div>
                <div>
                  <Label className="mb-1.5">Telefone (opcional)</Label>
                  <Input
                    value={creating.customerPhone}
                    onChange={(e) => updateCreateForm({ customerPhone: e.target.value })}
                    placeholder="5511999999999"
                  />
                </div>
              </div>

              <div>
                <Label className="mb-1.5">Serviço</Label>
                {services.length > 0 ? (
                  <select
                    value={creating.serviceId}
                    onChange={(e) => {
                      const svc = services.find((s) => s.id === e.target.value);
                      updateCreateForm({
                        serviceId: e.target.value,
                        serviceName: svc?.name ?? "",
                      });
                    }}
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                  >
                    <option value="">Selecione um serviço</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    value={creating.serviceName}
                    onChange={(e) => updateCreateForm({ serviceName: e.target.value })}
                    placeholder="Ex.: Corte de cabelo"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5">Data</Label>
                  <Input
                    type="date"
                    value={creating.date}
                    onChange={(e) => updateCreateForm({ date: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="mb-1.5">Hora</Label>
                  <Input
                    type="time"
                    value={creating.time}
                    onChange={(e) => updateCreateForm({ time: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label className="mb-1.5">Duração (minutos)</Label>
                <Input
                  type="number"
                  min={5}
                  step={5}
                  value={creating.durationMins}
                  onChange={(e) => updateCreateForm({ durationMins: e.target.value })}
                />
              </div>

              <div>
                <Label className="mb-1.5">Observações</Label>
                <Textarea
                  value={creating.notes}
                  onChange={(e) => updateCreateForm({ notes: e.target.value })}
                  placeholder="Notas internas sobre este agendamento"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setCreating(null)} disabled={createMutation.isPending}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="gap-1.5 bg-brand-600 hover:bg-brand-700 text-white"
                disabled={createMutation.isPending || !creating.serviceName.trim()}
                onClick={() => createMutation.mutate(creating)}
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Criar agendamento
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

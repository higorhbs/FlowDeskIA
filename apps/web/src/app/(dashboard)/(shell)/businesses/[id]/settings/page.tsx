"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { businessApi, scheduleApi } from "@/lib/api";
import { useForm, Controller, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Loader2,
  Building2,
  Phone,
  MapPin,
  FileText,
  Clock,
  MessageSquare,
  MessageCircle,
  DoorClosed,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  RotateCw,
  Scissors,
  UtensilsCrossed,
  Stethoscope,
  Store,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  TemplateMessageField,
  TemplateVariablesHelp,
} from "@/components/business/TemplateMessageField";
import { BusinessTypePicker } from "@/components/business/BusinessTypePicker";
import { WhatsAppMessagePreview, type PreviewMessage } from "@/components/business/WhatsAppMessagePreview";
import {
  WorkingHoursEditor,
  defaultWorkingHours,
  type WorkingHoursValue,
  type SpecialHoursValue,
  type LunchBreakValue,
  type ScheduleCommitSnapshot,
} from "@/components/business/WorkingHoursEditor";
import { useBusinessId } from "@/lib/use-business-id";
import { persistBusinessSnapshot } from "@/lib/business-route";
import { BUSINESS_TYPE_ORDER, BUSINESS_TYPE_LABELS, DEFAULT_LUNCH_MSG } from "@flowdesk/shared";
import { cn } from "@/lib/utils";

const businessTypeSchema = z.enum(BUSINESS_TYPE_ORDER);

const schema = z
  .object({
    name: z.string().min(2),
    type: businessTypeSchema,
    typeLabel: z.string().trim().max(60).optional(),
    phone: z.string().min(10),
    address: z.string().optional(),
    description: z.string().optional(),
    greetingMsg: z.string().min(5),
    awayMsg: z.string().min(5),
  })
  .superRefine((data, ctx) => {
    if (data.type === "OTHER" && (!data.typeLabel || data.typeLabel.trim().length < 2)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe o nome do tipo de negócio",
        path: ["typeLabel"],
      });
    }
  });

type FormData = z.infer<typeof schema>;
type SavePayload = { form: FormData; schedule?: ScheduleCommitSnapshot };

function normalizeWorkingHours(raw: unknown): WorkingHoursValue {
  if (!raw || typeof raw !== "object") return defaultWorkingHours();
  const wh = raw as WorkingHoursValue;
  return Object.keys(wh).length > 0 ? wh : defaultWorkingHours();
}

function normalizeLunchBreak(raw: unknown): LunchBreakValue {
  if (
    Array.isArray(raw) &&
    raw.length === 2 &&
    typeof raw[0] === "string" &&
    typeof raw[1] === "string"
  ) {
    return [raw[0], raw[1]];
  }
  return null;
}

function normalizeSpecialHours(raw: unknown): SpecialHoursValue {
  if (!raw || typeof raw !== "object") return {};
  const input = raw as Record<string, unknown>;
  const out: SpecialHoursValue = {};
  for (const [day, slot] of Object.entries(input)) {
    if (slot === null) {
      out[day] = null;
      continue;
    }
    if (
      Array.isArray(slot) &&
      slot.length === 2 &&
      typeof slot[0] === "string" &&
      typeof slot[1] === "string"
    ) {
      out[day] = [slot[0], slot[1]];
    }
  }
  return out;
}

function renderPreviewTemplate(text: string, businessName: string) {
  return text.replaceAll("{nome}", "Maria").replaceAll("{negocio}", businessName.trim() || "seu negócio");
}

// ── UI helpers ─────────────────────────────────────────────────────────────────

const TAB_IDS = ["geral", "horarios", "mensagens", "relatorio"] as const;
type SettingsTab = (typeof TAB_IDS)[number];

const FIELD_TAB: Partial<Record<keyof FormData, SettingsTab>> = {
  name: "geral",
  type: "geral",
  typeLabel: "geral",
  phone: "geral",
  address: "geral",
  description: "geral",
  greetingMsg: "mensagens",
  awayMsg: "mensagens",
};

type TabConfig = {
  id: SettingsTab;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  hasError?: boolean;
  active?: boolean;
};

function SettingsSectionNav({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: TabConfig[];
  activeTab: SettingsTab;
  onChange: (id: SettingsTab) => void;
}) {
  return (
    <>
      <nav className="hidden lg:flex lg:flex-col lg:gap-1.5">
        {tabs.map(({ id, label, description, icon: Icon, color, hasError, active }) => {
          const isActive = activeTab === id;
          return (
            <Button
              key={id}
              type="button"
              variant="ghost"
              onClick={() => onChange(id)}
              className={cn(
                "h-auto w-full items-start justify-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all",
                isActive ? "border-gray-200 bg-white shadow-sm" : "border-transparent hover:border-gray-200 hover:bg-white/60",
              )}
            >
              <div className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl", color)}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1 whitespace-normal">
                <div className="flex items-center gap-1.5">
                  <p className={cn("text-sm font-semibold truncate", isActive ? "text-gray-900" : "text-gray-700")}>
                    {label}
                  </p>
                  {hasError && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500" title="Verifique este campo" />}
                  {active !== undefined && !hasError && (
                    <span
                      className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", active ? "bg-emerald-500" : "bg-gray-300")}
                      title={active ? "Ativado" : "Desativado"}
                    />
                  )}
                </div>
                <p className="mt-0.5 text-xs leading-snug text-gray-500 whitespace-normal break-words">
                  {description}
                </p>
              </div>
              {isActive && <ChevronRight className="mt-2 w-4 h-4 flex-shrink-0 text-gray-400" />}
            </Button>
          );
        })}
      </nav>

      <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
        {tabs.map(({ id, label, icon: Icon, color, hasError }) => {
          const isActive = activeTab === id;
          return (
            <Button
              key={id}
              type="button"
              variant="ghost"
              onClick={() => onChange(id)}
              className={cn(
                "h-auto flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all",
                isActive ? "bg-gray-900 text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200",
              )}
            >
              <span className={cn("flex h-5 w-5 items-center justify-center rounded-lg", isActive ? "bg-white/15" : color)}>
                <Icon className={cn("w-3 h-3", isActive && "text-white")} />
              </span>
              {label}
              {hasError && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
            </Button>
          );
        })}
      </div>
    </>
  );
}

function TabPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5 rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="text-[15px] font-semibold leading-tight text-gray-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs leading-snug text-gray-500">{description}</p>}
      </div>
      <div className="h-px bg-gray-100" />
      {children}
    </div>
  );
}

type FieldProps = {
  label: string;
  icon?: React.ReactNode;
  error?: string;
  hint?: string;
  children: React.ReactNode;
};

function Field({ label, icon, error, hint, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-[13px] text-gray-700 font-medium">
        {icon && <span className="text-gray-400">{icon}</span>}
        {label}
      </Label>
      {children}
      {!error && hint && <p className="text-[11px] text-gray-400 leading-relaxed">{hint}</p>}
      {error && (
        <p className="text-[11px] text-red-500 flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-red-400 flex-shrink-0 inline-block" />
          {error}
        </p>
      )}
    </div>
  );
}

function CharCount({ value, max }: { value: string; max: number }) {
  const len = value?.length ?? 0;
  return (
    <span className={cn("text-[11px] tabular-nums", len > max * 0.8 ? "text-amber-500" : "text-gray-400")}>
      {len}/{max}
    </span>
  );
}

const INPUT_CLS =
  "h-11 rounded-xl border-gray-200 bg-white px-3.5 text-sm shadow-sm transition-shadow focus-visible:border-brand-400 focus-visible:ring-4 focus-visible:ring-brand-100";
const TEXTAREA_CLS =
  "rounded-xl border-gray-200 bg-white px-3.5 py-3 text-sm shadow-sm transition-shadow focus-visible:border-brand-400 focus-visible:ring-4 focus-visible:ring-brand-100";
const ERROR_RING_CLS = "border-red-300 focus-visible:border-red-400 focus-visible:ring-red-100";
// Usada sobre o TemplateMessageField, que já define seu próprio focus ring via a classe global ".input".
const TEMPLATE_FIELD_CLS = "rounded-xl border-gray-200 shadow-sm px-3.5 py-3";
const TEMPLATE_FIELD_ERROR_CLS = "border-red-300";

function IconInput({
  icon: Icon,
  className,
  ...props
}: { icon: LucideIcon } & React.ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
      <Input className={cn(INPUT_CLS, "pl-10", className)} {...props} />
    </div>
  );
}

function PrettySelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cn(
          "h-11 w-full appearance-none rounded-xl border border-gray-200 bg-white pl-3.5 pr-9 text-sm shadow-sm transition-shadow focus:outline-none focus-visible:border-brand-400 focus-visible:ring-4 focus-visible:ring-brand-100",
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
    </div>
  );
}

type SyncStatus = "saving" | "error" | "pending" | "saved";

function SyncStatusPill({ status, onRetry }: { status: SyncStatus; onRetry: () => void }) {
  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Salvando...
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600">
        <AlertTriangle className="h-3.5 w-3.5" />
        Erro ao salvar
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-red-700 hover:bg-red-200"
        >
          <RotateCw className="h-3 w-3" />
          Tentar de novo
        </button>
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
        Alterações pendentes...
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Tudo salvo
    </span>
  );
}

const HERO_TYPE_ICON: Partial<Record<FormData["type"], LucideIcon>> = {
  BARBERSHOP: Scissors,
  RESTAURANT: UtensilsCrossed,
  DENTAL: Stethoscope,
  STORE: Store,
  OTHER: LayoutGrid,
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const businessId = useBusinessId();
  const queryClient = useQueryClient();

  const { data: business, isLoading, isError } = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => businessApi.get(businessId),
    enabled: !!businessId,
  });

  const [workingHours, setWorkingHours] = useState<WorkingHoursValue>(defaultWorkingHours());
  const [specialHours, setSpecialHours] = useState<SpecialHoursValue>({});
  const [lunchBreak, setLunchBreak] = useState<LunchBreakValue>(null);
  const [lunchMsg, setLunchMsg] = useState(DEFAULT_LUNCH_MSG);
  const [appointmentBufferMins, setAppointmentBufferMins] = useState(0);
  const [dailyReportEnabled, setDailyReportEnabled] = useState(false);
  const [dailyReportHour, setDailyReportHour] = useState(20);
  const [dailyReportMinute, setDailyReportMinute] = useState(0);
  const [hoursDirty, setHoursDirty] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("geral");
  const [previewMode, setPreviewMode] = useState<"greeting" | "away">("greeting");

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const greetingMsg = watch("greetingMsg") ?? "";
  const awayMsg = watch("awayMsg") ?? "";
  const description = watch("description") ?? "";
  const businessType = watch("type");
  const businessName = watch("name") ?? "";

  useEffect(() => {
    if (!business) return;
    if (business.id && business.type) persistBusinessSnapshot({ id: business.id, type: business.type });
    reset({
      name: business.name ?? "",
      type: businessTypeSchema.safeParse(business.type).success
        ? (business.type as FormData["type"])
        : "OTHER",
      typeLabel: business.typeLabel ?? "",
      phone: business.phone ?? "",
      address: business.address ?? "",
      description: business.description ?? "",
      greetingMsg: business.greetingMsg ?? "Olá! Como posso ajudar?",
      awayMsg: business.awayMsg ?? "No momento estamos fechados. Em breve retornaremos!",
    });
    setWorkingHours(normalizeWorkingHours(business.workingHours));
    setSpecialHours(normalizeSpecialHours((business as { specialHours?: unknown }).specialHours));
    setLunchBreak(normalizeLunchBreak((business as { lunchBreak?: unknown }).lunchBreak));
    setLunchMsg(
      typeof (business as { lunchMsg?: unknown }).lunchMsg === "string" &&
        (business as { lunchMsg: string }).lunchMsg.trim()
        ? (business as { lunchMsg: string }).lunchMsg
        : DEFAULT_LUNCH_MSG
    );
    setAppointmentBufferMins(
      typeof (business as { appointmentBufferMins?: unknown }).appointmentBufferMins === "number"
        ? (business as { appointmentBufferMins: number }).appointmentBufferMins
        : 0
    );
    setDailyReportEnabled((business as { dailyReportEnabled?: boolean }).dailyReportEnabled === true);
    setDailyReportHour(
      typeof (business as { dailyReportHour?: unknown }).dailyReportHour === "number"
        ? (business as { dailyReportHour: number }).dailyReportHour
        : 20
    );
    setDailyReportMinute(
      typeof (business as { dailyReportMinute?: unknown }).dailyReportMinute === "number"
        ? (business as { dailyReportMinute: number }).dailyReportMinute
        : 0
    );
    setHoursDirty(false);
  }, [business, reset]);

  const saveMutation = useMutation({
    mutationFn: async ({ form, schedule }: SavePayload) => {
      const nextWorkingHours = schedule?.workingHours ?? workingHours;
      const nextSpecialHours = schedule?.specialHours ?? specialHours;
      const nextLunchBreak = schedule?.lunchBreak ?? lunchBreak;
      const nextLunchMsg = schedule?.lunchMsg ?? lunchMsg;
      if (nextLunchBreak && nextLunchMsg.trim().length < 5) {
        throw new Error("A mensagem de almoço precisa ter pelo menos 5 caracteres.");
      }
      const updated = await businessApi.update(businessId, {
        ...form,
        typeLabel: form.type === "OTHER" ? form.typeLabel?.trim() : undefined,
        workingHours: nextWorkingHours,
        specialHours: nextSpecialHours,
        lunchBreak: nextLunchBreak,
        lunchMsg: nextLunchBreak ? nextLunchMsg.trim() : undefined,
        appointmentBufferMins: form.type === "BARBERSHOP" ? appointmentBufferMins : 0,
        dailyReportEnabled,
        dailyReportHour,
        dailyReportMinute,
      });
      await scheduleApi.put(businessId, {
        timezone: business?.timezone ?? "America/Sao_Paulo",
        workingHours: nextWorkingHours,
        specialHours: nextSpecialHours,
        lunchBreak: nextLunchBreak,
        lunchMsg: nextLunchBreak ? nextLunchMsg.trim() : undefined,
      });
      return updated;
    },
    onSuccess: (_data, variables) => {
      if (variables.schedule) {
        setWorkingHours(variables.schedule.workingHours);
        setSpecialHours(variables.schedule.specialHours);
        setLunchBreak(variables.schedule.lunchBreak);
        setLunchMsg(variables.schedule.lunchMsg);
      }
      setHoursDirty(false);
      persistBusinessSnapshot({ id: businessId, type: variables.form.type });
      queryClient.invalidateQueries({ queryKey: ["business", businessId] });
      queryClient.invalidateQueries({ queryKey: ["schedule", businessId] });
      queryClient.invalidateQueries({ queryKey: ["businesses"] });
      toast.success("Configurações salvas com sucesso!");
    },
    onError: (err: Error) =>
      toast.error(err.message?.includes("almoço") ? err.message : "Erro ao salvar configurações"),
  });

  function focusFirstErrorTab(formErrors: FieldErrors<FormData>) {
    const firstKey = Object.keys(formErrors)[0] as keyof FormData | undefined;
    const tab = firstKey ? FIELD_TAB[firstKey] : undefined;
    if (tab) setActiveTab(tab);
  }

  // ── Autosave ───────────────────────────────────────────────────────────────
  // Sempre lê o estado mais recente (evita closures desatualizadas dentro do timer).
  const latestSubmitRef = useRef<() => void>(() => {});
  useEffect(() => {
    latestSubmitRef.current = () => {
      if (saveMutation.isPending) return;
      void handleSubmit((form) => saveMutation.mutate({ form }), focusFirstErrorTab)();
    };
  });

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleAutosave() {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => latestSubmitRef.current(), 900);
  }

  function saveNow() {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    latestSubmitRef.current();
  }

  function markDirty() {
    setHoursDirty(true);
    scheduleAutosave();
  }

  useEffect(() => {
    const subscription = watch((_values, info) => {
      if (info.type === "change") scheduleAutosave();
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch]);

  useEffect(() => () => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
  }, []);

  const hasChanges = isDirty || hoursDirty;
  const syncStatus: SyncStatus = saveMutation.isPending
    ? "saving"
    : saveMutation.isError
    ? "error"
    : hasChanges
    ? "pending"
    : "saved";
  const W = "w-full max-w-2xl mx-auto px-4 sm:px-6";

  const geralHasError = Boolean(errors.name || errors.type || errors.typeLabel || errors.phone);
  const mensagensHasError = Boolean(errors.greetingMsg || errors.awayMsg);

  const tabs: TabConfig[] = [
    { id: "geral", label: "Geral", description: "Nome, tipo e contato", icon: Building2, color: "bg-blue-100 text-blue-600", hasError: geralHasError },
    { id: "horarios", label: "Horários", description: "Funcionamento, almoço e exceções", icon: Clock, color: "bg-emerald-100 text-emerald-600" },
    { id: "mensagens", label: "Mensagens", description: "Boas-vindas e fora do horário", icon: MessageSquare, color: "bg-violet-100 text-violet-600", hasError: mensagensHasError },
    { id: "relatorio", label: "Relatório", description: "Resumo diário no seu WhatsApp", icon: FileText, color: "bg-amber-100 text-amber-600", active: dailyReportEnabled },
  ];

  const previewMessages: PreviewMessage[] = useMemo(() => {
    const botText = previewMode === "greeting" ? greetingMsg : awayMsg;
    return [
      { from: "customer", text: previewMode === "greeting" ? "Oi, boa tarde!" : "Vocês estão abertos agora?" },
      { from: "bot", text: renderPreviewTemplate(botText, businessName) },
    ];
  }, [previewMode, greetingMsg, awayMsg, businessName]);

  if (!businessId || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-brand-400" />
        <p className="text-sm text-gray-400">Carregando configurações...</p>
      </div>
    );
  }

  if (isError || !business) {
    return (
      <div className={cn(W, "py-10")}>
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="text-sm text-red-600 font-medium">
            Não foi possível carregar as configurações do negócio.
          </p>
        </div>
      </div>
    );
  }

  const HeroIcon = HERO_TYPE_ICON[businessType] ?? Building2;
  const typeLabel = business.typeLabel?.trim() || BUSINESS_TYPE_LABELS[businessType as FormData["type"]] || "Negócio";

  return (
    <div className="min-h-full bg-gray-50/60 pb-10">

      {/* ── Hero banner ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-600 to-brand-800 px-4 sm:px-6 py-8 sm:py-9">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-brand-300/20 blur-3xl" aria-hidden />
        <div className="relative max-w-5xl mx-auto flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0 border border-white/20 shadow-inner">
            <HeroIcon className="w-7 h-7 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-brand-200 text-xs font-semibold tracking-wide uppercase mb-0.5">
              Configurações
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{business.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-brand-100/90">
              <span className="inline-flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {typeLabel}
              </span>
              {business.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {business.phone}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Form ────────────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit((d) => saveMutation.mutate({ form: d }), focusFirstErrorTab)}
        className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 lg:grid lg:grid-cols-[240px_1fr] lg:gap-6 lg:items-start"
      >
        <div className="lg:sticky lg:top-6 mb-4 lg:mb-0">
          <SettingsSectionNav tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>

        <div className="space-y-4 min-w-0">
          {activeTab === "geral" && (
            <TabPanel title="Informações básicas" description="Nome, tipo e dados de contato do seu negócio">
              <Field label="Nome do negócio" error={errors.name?.message}>
                <IconInput
                  icon={Building2}
                  type="text"
                  placeholder="Ex.: Horizonte Serviços"
                  {...register("name")}
                  className={cn(errors.name && ERROR_RING_CLS)}
                />
              </Field>

              <Field label="Tipo de negócio" error={errors.type?.message}>
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <Controller
                      name="typeLabel"
                      control={control}
                      render={({ field: labelField }) => (
                        <BusinessTypePicker
                          value={field.value}
                          onChange={field.onChange}
                          typeLabel={labelField.value ?? ""}
                          onTypeLabelChange={labelField.onChange}
                          typeLabelError={errors.typeLabel?.message}
                        />
                      )}
                    />
                  )}
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  label="Telefone WhatsApp"
                  error={errors.phone?.message}
                  hint="Com DDI e DDD, sem espaços"
                >
                  <IconInput
                    icon={Phone}
                    type="text"
                    placeholder="5511999999999"
                    {...register("phone")}
                    className={cn(errors.phone && ERROR_RING_CLS)}
                  />
                </Field>

                <Field label="Endereço" hint="Exibido aos clientes">
                  <IconInput
                    icon={MapPin}
                    type="text"
                    placeholder="Rua Example, 123 – Cidade"
                    {...register("address")}
                  />
                </Field>
              </div>

              <Field label="Descrição" hint="Apresentação do seu negócio">
                <div className="relative">
                  <Textarea
                    className={cn(TEXTAREA_CLS, "min-h-20 resize-none pr-14")}
                    placeholder="Descreva seu negócio, especialidades, diferenciais..."
                    maxLength={300}
                    {...register("description")}
                  />
                  <span className="absolute bottom-2.5 right-3 pointer-events-none">
                    <CharCount value={description} max={300} />
                  </span>
                </div>
              </Field>
            </TabPanel>
          )}

          {activeTab === "horarios" && (
            <TabPanel title="Horário de funcionamento" description="Fuso de Brasília · almoço e horários excepcionais por data">
              <WorkingHoursEditor
                value={workingHours}
                onChange={(v) => { setWorkingHours(v); markDirty(); }}
                specialHours={specialHours}
                onSpecialHoursChange={(v) => { setSpecialHours(v); markDirty(); }}
                lunchBreak={lunchBreak}
                onLunchBreakChange={(v) => { setLunchBreak(v); markDirty(); }}
                lunchMsg={lunchMsg}
                onLunchMsgChange={(v) => { setLunchMsg(v); markDirty(); }}
                onCommit={(schedule) => {
                  if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
                  if (saveMutation.isPending) return;
                  void handleSubmit((form) => saveMutation.mutate({ form, schedule }), focusFirstErrorTab)();
                }}
              />

              {businessType === "BARBERSHOP" && (
                <div className="rounded-xl border border-gray-200 p-3 space-y-3 bg-white">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Intervalo entre clientes</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Tempo livre reservado após cada atendimento. A IA bloqueia horários dentro desse intervalo.
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {[0, 5, 10, 15, 20, 30].map((mins) => {
                      const active = appointmentBufferMins === mins;
                      return (
                        <Button
                          key={mins}
                          type="button"
                          variant={active ? "default" : "outline"}
                          size="xs"
                          onClick={() => {
                            setAppointmentBufferMins(mins);
                            markDirty();
                          }}
                          className={cn(
                            "text-xs h-auto",
                            active
                              ? "bg-brand-600 text-white hover:bg-brand-700"
                              : "text-gray-500 hover:text-brand-600 hover:border-brand-300 hover:bg-brand-50",
                          )}
                        >
                          {mins === 0 ? "Sem intervalo" : `${mins} min`}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabPanel>
          )}

          {activeTab === "mensagens" && (
            <div className="grid gap-4 lg:grid-cols-[1fr_260px] lg:items-start">
              <TabPanel title="Mensagens automáticas" description="Boas-vindas e respostas fora do expediente">
                <TemplateVariablesHelp />
                <Field
                  label="Mensagem de boas-vindas"
                  icon={<MessageCircle className="w-3.5 h-3.5" />}
                  error={errors.greetingMsg?.message}
                  hint="Enviada na primeira interação do cliente"
                >
                  <Controller
                    name="greetingMsg"
                    control={control}
                    render={({ field }) => (
                      <TemplateMessageField
                        value={field.value}
                        onChange={field.onChange}
                        rows={4}
                        maxLength={500}
                        placeholder="Olá {nome}! Bem-vindo ao {negocio}. Como posso ajudar?"
                        className={cn(TEMPLATE_FIELD_CLS, "pb-7", errors.greetingMsg && TEMPLATE_FIELD_ERROR_CLS)}
                        footer={
                          <div className="flex justify-end">
                            <CharCount value={greetingMsg} max={500} />
                          </div>
                        }
                      />
                    )}
                  />
                </Field>

                <div className="h-px bg-gray-100" />

                <Field
                  label="Mensagem fora do horário"
                  icon={<DoorClosed className="w-3.5 h-3.5" />}
                  error={errors.awayMsg?.message}
                  hint="Enviada quando o cliente escreve fora do expediente"
                >
                  <Controller
                    name="awayMsg"
                    control={control}
                    render={({ field }) => (
                      <TemplateMessageField
                        value={field.value}
                        onChange={field.onChange}
                        rows={4}
                        maxLength={500}
                        placeholder="Olá {nome}! No momento estamos fechados. Retornaremos em breve!"
                        className={cn(TEMPLATE_FIELD_CLS, "pb-1", errors.awayMsg && TEMPLATE_FIELD_ERROR_CLS)}
                        footer={
                          <div className="flex justify-end">
                            <CharCount value={awayMsg} max={500} />
                          </div>
                        }
                      />
                    )}
                  />
                </Field>
              </TabPanel>

              <div className="lg:sticky lg:top-6 space-y-2.5">
                <p className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Como o cliente vê
                </p>
                <div className="flex gap-1.5 rounded-full bg-gray-100 p-1">
                  {(["greeting", "away"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPreviewMode(mode)}
                      className={cn(
                        "flex-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors",
                        previewMode === mode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700",
                      )}
                    >
                      {mode === "greeting" ? "Boas-vindas" : "Fora do horário"}
                    </button>
                  ))}
                </div>
                <WhatsAppMessagePreview businessName={businessName} messages={previewMessages} />
              </div>
            </div>
          )}

          {activeTab === "relatorio" && (
            <TabPanel
              title="Relatório diário automático"
              description="Receba no seu WhatsApp o relatório dos agendamentos todo dia em um horário fixo"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">Envio automático</p>
                  <p className="text-xs text-gray-500 mt-0.5">Enviado para o seu próprio número conectado</p>
                </div>
                <Switch
                  checked={dailyReportEnabled}
                  onCheckedChange={(v) => { setDailyReportEnabled(v); markDirty(); }}
                />
              </div>

              {dailyReportEnabled && (
                <Field label="Horário de envio" icon={<Clock className="w-3.5 h-3.5" />} hint="Fuso do negócio">
                  <div className="flex items-center gap-2">
                    <PrettySelect
                      value={dailyReportHour}
                      onChange={(e) => { setDailyReportHour(Number(e.target.value)); markDirty(); }}
                      className="w-24"
                    >
                      {Array.from({ length: 24 }, (_, h) => (
                        <option key={h} value={h}>{String(h).padStart(2, "0")}</option>
                      ))}
                    </PrettySelect>
                    <span className="text-gray-400">:</span>
                    <PrettySelect
                      value={dailyReportMinute}
                      onChange={(e) => { setDailyReportMinute(Number(e.target.value)); markDirty(); }}
                      className="w-24"
                    >
                      {[0, 15, 30, 45].map((m) => (
                        <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
                      ))}
                    </PrettySelect>
                  </div>
                </Field>
              )}
            </TabPanel>
          )}
        </div>

        <Button type="submit" className="sr-only" />
      </form>

      {/* ── Autosave status (always visible while scrolling) ─────────── */}
      {/* bottom-24 on mobile to clear the MobileNav (~64px) + safe area   */}
      <div className="fixed bottom-24 right-4 sm:right-6 lg:bottom-8 z-50">
        <SyncStatusPill status={syncStatus} onRetry={saveNow} />
      </div>
    </div>
  );
}

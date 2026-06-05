"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { businessApi } from "@/lib/api";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Save,
  Building2,
  Phone,
  MapPin,
  FileText,
  Clock,
  MessageSquare,
  MessageCircle,
  DoorClosed,
  Settings2,
  CheckCircle2,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  TemplateMessageField,
  TemplateVariablesHelp,
} from "@/components/business/TemplateMessageField";
import { BusinessTypePicker } from "@/components/business/BusinessTypePicker";
import {
  WorkingHoursEditor,
  defaultWorkingHours,
  type WorkingHoursValue,
  type SpecialHoursValue,
  type LunchBreakValue,
} from "@/components/business/WorkingHoursEditor";
import { useBusinessId } from "@/lib/use-business-id";
import { persistBusinessSnapshot } from "@/lib/business-route";
import { BUSINESS_TYPE_ORDER, DEFAULT_LUNCH_MSG } from "@flowdesk/shared";
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

// ── UI helpers ─────────────────────────────────────────────────────────────────

type SectionCardProps = {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description?: string;
  children: React.ReactNode;
};

function SectionCard({ icon, iconBg, title, description, children }: SectionCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-4 px-6 pt-5 pb-4">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", iconBg)}>
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-gray-900 text-[15px] leading-tight">{title}</h2>
          {description && (
            <p className="text-xs text-gray-500 mt-0.5 leading-snug">{description}</p>
          )}
        </div>
      </div>
      <div className="border-t border-gray-100 px-6 py-5 space-y-5">{children}</div>
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
  const [hoursDirty, setHoursDirty] = useState(false);

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
    setHoursDirty(false);
  }, [business, reset]);

  const saveMutation = useMutation({
    mutationFn: (data: FormData) => {
      if (lunchBreak && lunchMsg.trim().length < 5) {
        throw new Error("A mensagem de almoço precisa ter pelo menos 5 caracteres.");
      }
      return businessApi.update(businessId, {
        ...data,
        typeLabel: data.type === "OTHER" ? data.typeLabel?.trim() : undefined,
        workingHours,
        specialHours,
        lunchBreak,
        lunchMsg: lunchBreak ? lunchMsg.trim() : undefined,
      });
    },
    onSuccess: (_data, variables) => {
      setHoursDirty(false);
      persistBusinessSnapshot({ id: businessId, type: variables.type });
      queryClient.invalidateQueries({ queryKey: ["business", businessId] });
      queryClient.invalidateQueries({ queryKey: ["businesses"] });
      toast.success("Configurações salvas com sucesso!");
    },
    onError: (err: Error) =>
      toast.error(err.message?.includes("almoço") ? err.message : "Erro ao salvar configurações"),
  });

  const hasChanges = isDirty || hoursDirty;
  const W = "w-full max-w-2xl mx-auto px-4 sm:px-6";

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

  return (
    <div className="min-h-full bg-gray-50/60 pb-10">

      {/* ── Hero banner ─────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-brand-600 via-brand-600 to-brand-700 px-4 sm:px-6 py-8">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0 border border-white/20">
              <Settings2 className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-brand-200 text-xs font-medium tracking-wide uppercase mb-0.5">
                Configurações
              </p>
              <h1 className="text-xl font-bold text-white truncate">{business.name}</h1>
              <p className="text-brand-200/80 text-xs mt-0.5">
                Gerencie as informações do seu negócio
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* ── Form ────────────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit((d) => saveMutation.mutate(d))}
        className={cn(W, "pt-6 space-y-4")}
      >
        {/* Informações básicas */}
        <SectionCard
          iconBg="bg-blue-100"
          icon={<Building2 className="w-5 h-5 text-blue-600" />}
          title="Informações básicas"
          description="Nome, tipo e dados de contato do seu negócio"
        >
          <Field label="Nome do negócio" icon={<Building2 className="w-3.5 h-3.5" />} error={errors.name?.message}>
            <Input
              type="text"
              placeholder="Ex.: Horizonte Serviços"
              {...register("name")}
              className={cn(errors.name && "border-red-300 focus-visible:ring-red-300")}
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
              icon={<Phone className="w-3.5 h-3.5" />}
              error={errors.phone?.message}
              hint="Com DDI e DDD, sem espaços"
            >
              <Input
                type="text"
                placeholder="5511999999999"
                {...register("phone")}
                className={cn(errors.phone && "border-red-300 focus-visible:ring-red-300")}
              />
            </Field>

            <Field label="Endereço" icon={<MapPin className="w-3.5 h-3.5" />} hint="Exibido aos clientes">
              <Input
                type="text"
                placeholder="Rua Example, 123 – Cidade"
                {...register("address")}
              />
            </Field>
          </div>

          <Field label="Descrição" icon={<FileText className="w-3.5 h-3.5" />} hint="Apresentação do seu negócio">
            <div className="relative">
              <Textarea
                className="min-h-20 resize-none pr-14"
                placeholder="Descreva seu negócio, especialidades, diferenciais..."
                maxLength={300}
                {...register("description")}
              />
              <span className="absolute bottom-2.5 right-3 pointer-events-none">
                <CharCount value={description} max={300} />
              </span>
            </div>
          </Field>
        </SectionCard>

        {/* Horário de funcionamento */}
        <SectionCard
          iconBg="bg-emerald-100"
          icon={<Clock className="w-5 h-5 text-emerald-600" />}
          title="Horário de funcionamento"
          description="Fuso de Brasília · almoço e horários excepcionais por data"
        >
          <WorkingHoursEditor
            value={workingHours}
            onChange={(v) => { setWorkingHours(v); setHoursDirty(true); }}
            specialHours={specialHours}
            onSpecialHoursChange={(v) => { setSpecialHours(v); setHoursDirty(true); }}
            lunchBreak={lunchBreak}
            onLunchBreakChange={(v) => { setLunchBreak(v); setHoursDirty(true); }}
            lunchMsg={lunchMsg}
            onLunchMsgChange={(v) => { setLunchMsg(v); setHoursDirty(true); }}
            onCommit={() => {
              if (saveMutation.isPending) return;
              void handleSubmit((d) => saveMutation.mutate(d))();
            }}
          />
        </SectionCard>

        {/* Mensagens automáticas */}
        <SectionCard
          iconBg="bg-violet-100"
          icon={<MessageSquare className="w-5 h-5 text-violet-600" />}
          title="Mensagens automáticas"
          description="Boas-vindas e respostas fora do expediente"
        >
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
                <div className="relative">
                  <TemplateMessageField
                    value={field.value}
                    onChange={field.onChange}
                    rows={4}
                    maxLength={500}
                    placeholder="Olá {nome}! Bem-vindo ao {negocio}. Como posso ajudar?"
                    className={cn("pb-7", errors.greetingMsg && "border-red-300 focus-visible:ring-red-300")}
                    footer={
                      <div className="flex justify-end">
                        <CharCount value={greetingMsg} max={500} />
                      </div>
                    }
                  />
                </div>
              )}
            />
          </Field>

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
                  className={cn("pb-1", errors.awayMsg && "border-red-300 focus-visible:ring-red-300")}
                  footer={
                    <div className="flex justify-end">
                      <CharCount value={awayMsg} max={500} />
                    </div>
                  }
                />
              )}
            />
          </Field>
        </SectionCard>

        <Button type="submit" className="sr-only" />
      </form>

      {/* ── Floating save button (always visible while scrolling) ─────── */}
      {/* bottom-24 on mobile to clear the MobileNav (~64px) + safe area   */}
      <div className="fixed bottom-24 right-4 sm:right-6 lg:bottom-8 z-50">
        <Button
          type="button"
          onClick={handleSubmit((d) => saveMutation.mutate(d))}
          disabled={saveMutation.isPending || !hasChanges}
          className={cn(
            "h-auto flex items-center gap-2.5 rounded-full px-5 py-3 text-sm font-semibold",
            "shadow-xl transition-all duration-200 ease-in-out",
            saveMutation.isPending
              ? "bg-brand-600 text-white cursor-wait shadow-brand-500/30 hover:bg-brand-600"
              : hasChanges
              ? "bg-brand-600 hover:bg-brand-700 active:scale-95 text-white shadow-brand-500/30 hover:shadow-brand-500/40"
              : saveMutation.isSuccess
              ? "bg-emerald-500 text-white shadow-emerald-500/30 cursor-default hover:bg-emerald-500"
              : "bg-white text-gray-400 border border-gray-200 shadow-gray-200/50 cursor-not-allowed hover:bg-white"
          )}
        >
          {saveMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          ) : saveMutation.isSuccess && !hasChanges ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <Save className="w-4 h-4 flex-shrink-0" />
          )}
          <span>
            {saveMutation.isPending
              ? "Salvando..."
              : saveMutation.isSuccess && !hasChanges
              ? "Salvo"
              : "Salvar alterações"}
          </span>
          {hasChanges && !saveMutation.isPending && (
            <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 animate-pulse" />
          )}
        </Button>
      </div>
    </div>
  );
}

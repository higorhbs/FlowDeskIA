"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Phone, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { businessApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ResumeFlowConfig } from "@flowdesk/firebase/client";
import {
  DEFAULT_RESUME_DOCUMENT_LABEL,
  DEFAULT_RESUME_FLOW_KEYWORDS,
  normalizeResumeFlowConfig,
} from "@flowdesk/shared";
import { TemplateMessageField } from "@/components/business/TemplateMessageField";
import { useDebouncedValue } from "@/lib/use-debounced-value";

type Props = {
  businessId: string;
  businessName: string;
  initialConfig?: ResumeFlowConfig | null;
};

function parseKeywords(raw: string): string[] {
  return raw
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
}

function serializeDraft(cfg: ResumeFlowConfig, keywordsDraft: string): string {
  return JSON.stringify(
    normalizeResumeFlowConfig({
      ...cfg,
      triggerKeywords: parseKeywords(keywordsDraft),
    }),
  );
}

const DOC_TEMPLATE_VARS = [
  { token: "{nome}", label: "Nome do cliente", shortHint: "Cliente" },
  { token: "{negocio}", label: "Nome do negócio", shortHint: "Negócio" },
  { token: "{documento}", label: "Nome do documento (ex: currículo, ficha)", shortHint: "Documento" },
] as const;

export function ResumeFlowEditor({ businessId, businessName, initialConfig }: Props) {
  const queryClient = useQueryClient();
  const savedRef = useRef(
    serializeDraft(
      normalizeResumeFlowConfig(initialConfig),
      (normalizeResumeFlowConfig(initialConfig).triggerKeywords.length
        ? normalizeResumeFlowConfig(initialConfig).triggerKeywords
        : DEFAULT_RESUME_FLOW_KEYWORDS
      ).join(", "),
    ),
  );
  const [cfg, setCfg] = useState<ResumeFlowConfig>(() => normalizeResumeFlowConfig(initialConfig));
  const [keywordsDraft, setKeywordsDraft] = useState(() => {
    const k = normalizeResumeFlowConfig(initialConfig).triggerKeywords;
    return (k.length ? k : DEFAULT_RESUME_FLOW_KEYWORDS).join(", ");
  });
  const [editing, setEditing] = useState(false);

  const draftSnapshot = useMemo(() => serializeDraft(cfg, keywordsDraft), [cfg, keywordsDraft]);
  const debouncedSnapshot = useDebouncedValue(draftSnapshot, 1500);
  const hasChanges = draftSnapshot !== savedRef.current;
  const serverSnapshot = useMemo(() => {
    const normalized = normalizeResumeFlowConfig(initialConfig);
    const k = normalized.triggerKeywords.length ? normalized.triggerKeywords : DEFAULT_RESUME_FLOW_KEYWORDS;
    return serializeDraft(normalized, k.join(", "));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialConfig ?? null)]);

  useEffect(() => {
    if (hasChanges) return;
    if (serverSnapshot === savedRef.current) return;
    const normalized = normalizeResumeFlowConfig(initialConfig);
    const k = normalized.triggerKeywords.length ? normalized.triggerKeywords : DEFAULT_RESUME_FLOW_KEYWORDS;
    setCfg(normalized);
    setKeywordsDraft(k.join(", "));
    savedRef.current = serverSnapshot;
  }, [serverSnapshot, hasChanges, initialConfig]);

  const saveMutation = useMutation({
    mutationFn: () =>
      businessApi.update(businessId, {
        resumeFlow: normalizeResumeFlowConfig({
          ...cfg,
          triggerKeywords: parseKeywords(keywordsDraft),
        }),
      } as Record<string, unknown>),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar"),
  });

  useEffect(() => {
    if (editing) return;
    if (debouncedSnapshot === savedRef.current) return;
    const snapshot = debouncedSnapshot;
    saveMutation.mutate(undefined, {
      onSuccess: () => {
        savedRef.current = snapshot;
        const saved = normalizeResumeFlowConfig(JSON.parse(snapshot) as ResumeFlowConfig);
        queryClient.setQueryData(["business", businessId], (prev: Record<string, unknown> | undefined) =>
          prev ? { ...prev, resumeFlow: saved } : prev,
        );
      },
    });
  }, [debouncedSnapshot, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50">
            <FileText className="h-6 w-6 text-teal-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">Geração de documentos</h2>
            <p className="mt-1 text-sm text-gray-500">
              Coleta dados no WhatsApp, revisão editável antes do PDF e reenvio após gerar.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
            <Switch
              checked={cfg.enabled}
              onCheckedChange={(enabled) => setCfg((prev) => ({ ...prev, enabled }))}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-5">
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Nome do documento para o cliente
          </Label>
          <input
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            value={cfg.documentLabel}
            onFocus={() => setEditing(true)}
            onBlur={() => setEditing(false)}
            onChange={(e) => setCfg((prev) => ({ ...prev, documentLabel: e.target.value }))}
            placeholder={DEFAULT_RESUME_DOCUMENT_LABEL}
          />
          <p className="mt-1.5 text-xs text-gray-400">
            Ex: currículo, ficha cadastral, proposta — aparece nas mensagens do WhatsApp como{" "}
            <span className="font-mono text-gray-500">{`{documento}`}</span>
          </p>
        </div>

        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Palavras que iniciam o fluxo
          </Label>
          <input
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            value={keywordsDraft}
            onFocus={() => setEditing(true)}
            onBlur={() => setEditing(false)}
            onChange={(e) => setKeywordsDraft(e.target.value)}
            placeholder={DEFAULT_RESUME_FLOW_KEYWORDS.join(", ")}
          />
          <p className="mt-1.5 text-xs text-gray-400">
            Ex: documento, gerar documento, pdf — separadas por vírgula
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-900">Receber na conversa comigo</p>
              <p className="mt-0.5 text-xs text-gray-500">
                PDF vai para &quot;Mensagens salvas&quot; / conversa com você mesmo no WhatsApp conectado.
              </p>
            </div>
            <Switch
              checked={cfg.notifySelf === true}
              onCheckedChange={(notifySelf) => {
                setCfg((prev) => ({
                  ...prev,
                  notifySelf,
                  notifyPhone: notifySelf ? "" : prev.notifyPhone,
                }));
                setTimeout(() => saveMutation.mutate(), 0);
              }}
            />
          </div>
          {!cfg.notifySelf && (
            <>
              <Label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">
                <Phone className="h-3.5 w-3.5" />
                WhatsApp da equipe
              </Label>
              <input
                className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                value={cfg.notifyPhone}
                onFocus={() => setEditing(true)}
                onBlur={() => setEditing(false)}
                onChange={(e) =>
                  setCfg((prev) => ({ ...prev, notifyPhone: e.target.value.replace(/\D/g, "") }))
                }
                placeholder="5511999999999"
                inputMode="numeric"
              />
              <p className="mt-1.5 text-xs text-gray-400">
                Outro número da equipe (DDI + DDD, só dígitos). Pode ser o mesmo do WhatsApp conectado.
              </p>
            </>
          )}
        </div>

        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Mensagem de boas-vindas
          </Label>
          <div className="mt-2">
            <TemplateMessageField
              value={cfg.welcomeMessage ?? ""}
              onChange={(welcomeMessage) => setCfg((prev) => ({ ...prev, welcomeMessage }))}
              rows={5}
              variables={DOC_TEMPLATE_VARS}
            />
          </div>
        </div>

        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Mensagem ao finalizar
          </Label>
          <div className="mt-2">
            <TemplateMessageField
              value={cfg.successMessage ?? ""}
              onChange={(successMessage) => setCfg((prev) => ({ ...prev, successMessage }))}
              rows={3}
              variables={DOC_TEMPLATE_VARS}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-teal-200 bg-teal-50/40 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-teal-800">
          <Sparkles className="h-4 w-4" />
          O que o bot pergunta
        </div>
        <ul className="mt-3 space-y-1.5 text-sm text-teal-900/80">
          <li>• Dados pessoais (nome, idade, cidade, telefone, e-mail, CNH)</li>
          <li>• Escolaridade e curso</li>
          <li>• Experiência profissional (com opção de adicionar mais de uma)</li>
          <li>• Cursos e objetivo (opcionais — digitar pular)</li>
          <li>• Um campo por vez, com validação (nome, idade, e-mail, telefone…)</li>
          <li>• Revisão completa antes de gerar o PDF (editar qualquer campo)</li>
          <li>• Após enviar, cliente digita <strong>editar {cfg.documentLabel || DEFAULT_RESUME_DOCUMENT_LABEL}</strong> para corrigir</li>
        </ul>
      </div>

      <div
        className={cn(
          "flex items-center justify-between rounded-xl px-4 py-3 text-sm",
          cfg.enabled && (cfg.notifySelf || cfg.notifyPhone) ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900",
        )}
      >
        <span className="flex items-center gap-2">
          <Zap className="h-4 w-4" />
          {cfg.enabled && cfg.notifySelf
            ? `Fluxo ativo — PDF do ${cfg.documentLabel || DEFAULT_RESUME_DOCUMENT_LABEL} vai para sua conversa com você mesmo.`
            : cfg.enabled && cfg.notifyPhone
            ? `Fluxo ativo — PDF do ${cfg.documentLabel || DEFAULT_RESUME_DOCUMENT_LABEL} vai para o WhatsApp da equipe.`
            : cfg.enabled
              ? "Ative informando quem receberá os PDFs."
              : "Fluxo desligado."}
        </span>
        {hasChanges && !saveMutation.isPending && (
          <Button type="button" size="sm" variant="outline" onClick={() => saveMutation.mutate()}>
            Salvar agora
          </Button>
        )}
      </div>
    </div>
  );
}

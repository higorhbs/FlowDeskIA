"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GitBranch,
  ImagePlus,
  Layers,
  Loader2,
  MessageSquare,
  MousePointerClick,
  Plus,
  Settings2,
  Smartphone,
  Sparkles,
  Trash2,
  X,
  HelpCircle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { businessApi, tenantApi } from "@/lib/api";
import { uploadLeadFlowMedia } from "@/lib/web-api/lead-flow";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AppLink as Link } from "@/components/AppLink";
import type { LeadCaptureFlow, LeadFlowNode } from "@flowdesk/firebase/client";
import type { PlanTier } from "@flowdesk/shared";
import {
  LEAD_FLOW_MAX_BUTTONS,
  LEAD_FLOW_MEDIA_ACCEPT,
  LEAD_FLOW_MAX_MEDIA_BYTES,
  LEAD_FLOW_MAX_MEDIA_LABEL,
  DEFAULT_LEAD_FLOW_IDLE_FOLLOW_UP_MINUTES,
  DEFAULT_LEAD_FLOW_IDLE_FOLLOW_UP_MESSAGE,
  countLeadFlowMediaNodes,
  getLeadFlowMediaLimit,
  leadFlowMediaQuotaMessage,
  newLeadFlowId,
  normalizeLeadCaptureFlow,
} from "@flowdesk/shared";
import { TemplateMessageField } from "@/components/business/TemplateMessageField";
import { LeadFlowWaPreview } from "@/components/ia/LeadFlowWaPreview";
import { useDebouncedValue } from "@/lib/use-debounced-value";

type Props = {
  businessId: string;
  businessName: string;
  initialFlow?: LeadCaptureFlow | null;
};

function parseTriggerKeywords(raw: string): string[] {
  return raw
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
}

function entryKeywordsDraftFromFlow(flow: LeadCaptureFlow): Record<string, string> {
  return Object.fromEntries(
    flow.nodes.map((n) => [n.id, (n.entryKeywords ?? []).join(", ")]),
  );
}

function applyEntryKeywordDrafts(
  flow: LeadCaptureFlow,
  drafts: Record<string, string>,
): LeadCaptureFlow {
  return {
    ...flow,
    nodes: flow.nodes.map((n) => ({
      ...n,
      entryKeywords:
        drafts[n.id] !== undefined
          ? parseTriggerKeywords(drafts[n.id])
          : n.entryKeywords,
    })),
  };
}

function serializeLeadFlowDraft(flow: LeadCaptureFlow, keywordsDraft: string): string {
  return JSON.stringify(
    normalizeLeadCaptureFlow({
      ...flow,
      triggerKeywords: parseTriggerKeywords(keywordsDraft),
    }),
  );
}

function mediaNodeLabel(mediaType?: LeadFlowNode["mediaType"]) {
  if (mediaType === "video") return "Vídeo";
  if (mediaType === "gif") return "GIF";
  return "Imagem";
}

function isAllowedLeadFlowFile(file: File) {
  if (file.type.startsWith("image/") || file.type.startsWith("video/")) return true;
  const lower = file.name.toLowerCase();
  return lower.endsWith(".gif") || lower.endsWith(".mp4") || lower.endsWith(".mov");
}

function nodeLabel(node: LeadFlowNode, index: number) {
  const preview = node.text.trim().slice(0, 42);
  return preview ? `Passo ${index + 1}: ${preview}` : `Passo ${index + 1}`;
}

function LeadFlowHelpItem({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-brand-50">
        {icon}
      </div>
      <div>
        <p className="mb-0.5 text-sm font-semibold text-gray-900">{title}</p>
        <div className="text-sm leading-relaxed text-gray-500">{children}</div>
      </div>
    </div>
  );
}

function parseLeadFlowSnapshot(snapshot: string): LeadCaptureFlow {
  return normalizeLeadCaptureFlow(JSON.parse(snapshot) as LeadCaptureFlow);
}

function SectionLabel({ icon, label, hint }: { icon: ReactNode; label: string; hint?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-gray-400">{icon}</span>
      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{label}</span>
      {hint && <span className="text-[10px] text-gray-400">{hint}</span>}
    </div>
  );
}

export function LeadFlowEditor({ businessId, businessName, initialFlow }: Props) {
  const queryClient = useQueryClient();
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const savedSnapshotRef = useRef(
    serializeLeadFlowDraft(
      normalizeLeadCaptureFlow(initialFlow),
      normalizeLeadCaptureFlow(initialFlow).triggerKeywords.join(", "),
    ),
  );
  const [uploadNodeId, setUploadNodeId] = useState<string | null>(null);
  const [openNodeId, setOpenNodeId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [flow, setFlow] = useState<LeadCaptureFlow>(() => normalizeLeadCaptureFlow(initialFlow));
  const [keywordsDraft, setKeywordsDraft] = useState(
    () => normalizeLeadCaptureFlow(initialFlow).triggerKeywords.join(", "),
  );
  const [entryKeywordsDrafts, setEntryKeywordsDrafts] = useState<Record<string, string>>(() =>
    entryKeywordsDraftFromFlow(normalizeLeadCaptureFlow(initialFlow)),
  );
  const [editing, setEditing] = useState(false);

  const draftSnapshot = useMemo(
    () =>
      serializeLeadFlowDraft(
        applyEntryKeywordDrafts(flow, entryKeywordsDrafts),
        keywordsDraft,
      ),
    [flow, keywordsDraft, entryKeywordsDrafts],
  );
  const debouncedSnapshot = useDebouncedValue(draftSnapshot, 1500);
  const hasChanges = draftSnapshot !== savedSnapshotRef.current;
  const serverSnapshot = useMemo(
    () =>
      serializeLeadFlowDraft(
        normalizeLeadCaptureFlow(initialFlow),
        normalizeLeadCaptureFlow(initialFlow).triggerKeywords.join(", "),
      ),
    // content-stable sync key
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(initialFlow ?? null)],
  );

  useEffect(() => {
    if (hasChanges) return;
    if (serverSnapshot === savedSnapshotRef.current) return;
    const normalized = normalizeLeadCaptureFlow(initialFlow);
    const keywords = normalized.triggerKeywords.join(", ");
    const drafts = entryKeywordsDraftFromFlow(normalized);
    setFlow(normalized);
    setKeywordsDraft(keywords);
    setEntryKeywordsDrafts(drafts);
    savedSnapshotRef.current = serializeLeadFlowDraft(
      applyEntryKeywordDrafts(normalized, drafts),
      keywords,
    );
  }, [serverSnapshot, hasChanges, initialFlow]);

  const { data: tenant } = useQuery({
    queryKey: ["tenant"],
    queryFn: () => tenantApi.get(),
  });
  const plan = (tenant?.plan ?? "STARTER") as PlanTier;
  const mediaLimit = getLeadFlowMediaLimit(plan);
  const mediaUsed = countLeadFlowMediaNodes(flow);
  const mediaLeft = Math.max(0, mediaLimit - mediaUsed);

  const nodeOptions = useMemo(
    () => flow.nodes.map((n, i) => ({ id: n.id, label: nodeLabel(n, i) })),
    [flow.nodes],
  );

  const saveMutation = useMutation({
    mutationFn: () => {
      const triggerKeywords = parseTriggerKeywords(keywordsDraft);
      return businessApi.update(businessId, {
        leadFlow: normalizeLeadCaptureFlow({
          ...applyEntryKeywordDrafts(flow, entryKeywordsDrafts),
          triggerKeywords,
        }),
      } as Record<string, unknown>);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar"),
  });

  useEffect(() => {
    if (editing) return;
    if (debouncedSnapshot === savedSnapshotRef.current) return;
    const snapshot = debouncedSnapshot;
    saveMutation.mutate(undefined, {
      onSuccess: () => {
        savedSnapshotRef.current = snapshot;
        const savedFlow = parseLeadFlowSnapshot(snapshot);
        queryClient.setQueryData(["business", businessId], (prev: Record<string, unknown> | undefined) =>
          prev ? { ...prev, leadFlow: savedFlow } : prev,
        );
      },
    });
  }, [debouncedSnapshot, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const uploadMutation = useMutation({
    mutationFn: ({ nodeId, file }: { nodeId: string; file: File }) =>
      uploadLeadFlowMedia(businessId, file, nodeId),
    onSuccess: (saved, { nodeId }) => {
      setFlow((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                imageUrl: saved.mediaUrl,
                imageStoragePath: saved.mediaStoragePath,
                mediaType: saved.mediaType,
              }
            : n,
        ),
      }));
      toast.success(`${mediaNodeLabel(saved.mediaType)} enviado!`);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Erro ao enviar mídia"),
  });

  function patchFlow(patch: Partial<LeadCaptureFlow>) {
    setFlow((prev) => ({ ...prev, ...patch }));
  }

  function patchNode(nodeId: string, patch: Partial<LeadFlowNode>) {
    setFlow((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)),
    }));
  }

  function addNode() {
    const id = newLeadFlowId("node");
    setFlow((prev) => ({
      ...prev,
      nodes: [
        ...prev.nodes,
        {
          id,
          text: "",
          buttons: [],
        },
      ],
    }));
    setOpenNodeId(id);
  }

  function removeNode(nodeId: string) {
    setEntryKeywordsDrafts((prev) => {
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
    setFlow((prev) => {
      const nodes = prev.nodes
        .filter((n) => n.id !== nodeId)
        .map((n) => ({
          ...n,
          buttons: n.buttons.map((b) =>
            b.nextNodeId === nodeId ? { ...b, nextNodeId: undefined } : b,
          ),
        }));
      const startNodeId =
        prev.startNodeId === nodeId ? nodes[0]?.id ?? prev.startNodeId : prev.startNodeId;
      return { ...prev, nodes, startNodeId };
    });
  }

  function moveNode(nodeId: string, dir: -1 | 1) {
    setFlow((prev) => {
      const idx = prev.nodes.findIndex((n) => n.id === nodeId);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= prev.nodes.length) return prev;
      const nodes = [...prev.nodes];
      [nodes[idx], nodes[target]] = [nodes[target]!, nodes[idx]!];
      return { ...prev, nodes };
    });
  }

  function onPickFile(nodeId: string, file: File | null) {
    if (!file) return;
    if (file.size > LEAD_FLOW_MAX_MEDIA_BYTES) {
      toast.error(`Arquivo muito grande (máx. ${LEAD_FLOW_MAX_MEDIA_LABEL}).`);
      return;
    }
    if (!isAllowedLeadFlowFile(file)) {
      toast.error("Use JPEG, PNG, WebP, GIF ou MP4");
      return;
    }
    const node = flow.nodes.find((n) => n.id === nodeId);
    const replacing = Boolean(node?.imageUrl);
    if (!replacing && mediaLeft <= 0) {
      toast.error(
        mediaLimit === 1
          ? "Seu plano permite 1 mídia no fluxo. Faça upgrade para adicionar mais."
          : `Seu plano permite ${mediaLimit} mídias no fluxo e você já usou todas.`,
      );
      return;
    }
    uploadMutation.mutate({ nodeId, file });
  }

  const previewStart = flow.nodes.find((n) => n.id === flow.startNodeId) ?? flow.nodes[0];
  const previewNode = (openNodeId ? flow.nodes.find((n) => n.id === openNodeId) : null) ?? previewStart;
  const previewNodeIndex = flow.nodes.findIndex((n) => n.id === previewNode?.id);

  return (
    <div
      ref={editorRef}
      className="space-y-5"
      onFocusCapture={() => setEditing(true)}
      onBlurCapture={(e) => {
        const next = e.relatedTarget as Node | null;
        if (!next || !editorRef.current?.contains(next)) setEditing(false);
      }}
    >
      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept={LEAD_FLOW_MEDIA_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          if (uploadNodeId) onPickFile(uploadNodeId, file);
          e.target.value = "";
          setUploadNodeId(null);
        }}
      />

      {/* ── Header ── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50">
              <GitBranch className="h-5 w-5 text-brand-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Vendas guiadas</h2>
              <p className="mt-0.5 text-sm text-gray-500">
                Fluxo automático com botões e mídia no WhatsApp — guia o cliente do interesse à compra.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Switch
              checked={flow.enabled}
              onCheckedChange={(enabled) => patchFlow({ enabled })}
            />
            <span className={cn("text-[11px] font-medium", flow.enabled ? "text-brand-600" : "text-gray-400")}>
              {flow.enabled ? "Ativo" : "Inativo"}
            </span>
          </div>
        </div>

        {/* Media quota bar */}
        <div className="mt-4 flex items-center justify-between rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-2.5">
          <p className="text-sm text-gray-600">{leadFlowMediaQuotaMessage(plan)}</p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-brand-700">{mediaUsed}</span>
              <span className="text-sm text-gray-400">/</span>
              <span className="text-sm text-gray-500">{mediaLimit} mídias</span>
            </div>
            {mediaLeft === 0 && (
              <Link
                href="/plan"
                className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-700"
              >
                Upgrade
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="flex items-start gap-5">

        {/* Left: config + steps */}
        <div className="min-w-0 flex-1 space-y-4">

          {/* Trigger config */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-brand-600" />
              <h3 className="text-sm font-semibold text-gray-900">Quando ativar o fluxo</h3>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Iniciar na saudação</p>
                <p className="mt-0.5 text-xs text-gray-400">
                  Cliente manda &quot;oi&quot;, &quot;olá&quot;... → fluxo começa automaticamente
                </p>
              </div>
              <Switch
                checked={flow.startOnGreeting}
                onCheckedChange={(startOnGreeting) => patchFlow({ startOnGreeting })}
              />
            </div>

            <div>
              <Label className="text-xs font-medium text-gray-700">Palavras-chave adicionais</Label>
              <input
                value={keywordsDraft}
                onChange={(e) => setKeywordsDraft(e.target.value)}
                onBlur={() =>
                  setFlow((prev) => ({
                    ...prev,
                    triggerKeywords: parseTriggerKeywords(keywordsDraft),
                  }))
                }
                placeholder="interesse, orçamento, informação"
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              <p className="mt-1 text-[11px] text-gray-400">
                Separe com vírgula · cliente digita uma dessas → fluxo reinicia do início
              </p>
            </div>
          </div>

          {/* Steps */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-brand-600" />
                <h3 className="text-sm font-semibold text-gray-900">Passos do fluxo</h3>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                  {flow.nodes.length}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addNode}
                className="rounded-xl"
              >
                <Plus className="h-4 w-4" />
                Novo passo
              </Button>
            </div>

            {/* Step cards */}
            <div className="space-y-2">
              {flow.nodes.map((node, index) => {
                const open = openNodeId === node.id;
                const isStart = flow.startNodeId === node.id;
                const nodeHasMedia = Boolean(node.imageUrl);
                const canAddMedia = nodeHasMedia || mediaLeft > 0;

                return (
                  <div
                    key={node.id}
                    className={cn(
                      "overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-150",
                      open
                        ? "border-brand-200 shadow-brand-100/60 shadow-md"
                        : "border-gray-200",
                    )}
                  >
                    {/* Card header */}
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      {/* Number badge — click to set as start */}
                      <button
                        type="button"
                        title={isStart ? "Passo inicial" : "Definir como passo inicial"}
                        onClick={() => patchFlow({ startNodeId: node.id })}
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                          isStart
                            ? "bg-brand-600 text-white"
                            : "bg-gray-100 text-gray-500 hover:bg-brand-100 hover:text-brand-700",
                        )}
                      >
                        {index + 1}
                      </button>

                      {/* Label / expand toggle */}
                      <button
                        type="button"
                        onClick={() => setOpenNodeId(open ? null : node.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span className="flex-1 truncate text-sm font-medium text-gray-900">
                          {node.text.trim() ? node.text.trim().slice(0, 48) : `Passo ${index + 1}`}
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {isStart && (
                            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand-700">
                              Início
                            </span>
                          )}
                          {node.buttons.length > 0 && !open && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-medium text-gray-500">
                              {node.buttons.length} {node.buttons.length === 1 ? "botão" : "botões"}
                            </span>
                          )}
                          {node.imageUrl && !open && (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-medium text-gray-500">
                              mídia
                            </span>
                          )}
                        </div>
                      </button>

                      {/* Action buttons */}
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => moveNode(node.id, -1)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={index === flow.nodes.length - 1}
                          onClick={() => moveNode(node.id, 1)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (flow.nodes.length <= 1) {
                              toast.error("Precisa de ao menos um passo");
                              return;
                            }
                            if (confirm("Remover este passo?")) removeNode(node.id);
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <div className="mx-1 h-4 w-px bg-gray-200" />
                        <button
                          type="button"
                          onClick={() => setOpenNodeId(open ? null : node.id)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100"
                        >
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 transition-transform duration-200",
                              open && "rotate-180",
                            )}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Expanded body */}
                    {open && (
                      <div className="border-t border-gray-100">

                        {/* Message */}
                        <div className="space-y-2 p-4">
                          <SectionLabel
                            icon={<MessageSquare className="h-3.5 w-3.5" />}
                            label="Mensagem"
                          />
                          <TemplateMessageField
                            value={node.text}
                            onChange={(text) => patchNode(node.id, { text })}
                            rows={5}
                            placeholder="Texto enviado com os botões..."
                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                          />
                        </div>

                        {/* Media */}
                        <div className="space-y-2 border-t border-gray-50 px-4 py-3">
                          <SectionLabel
                            icon={<ImagePlus className="h-3.5 w-3.5" />}
                            label="Mídia"
                            hint={`opcional · imagem, GIF ou vídeo (até ${LEAD_FLOW_MAX_MEDIA_LABEL})`}
                          />
                          <div className="flex flex-wrap items-center gap-3">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-xl"
                              disabled={uploadMutation.isPending || !canAddMedia}
                              onClick={() => {
                                if (!canAddMedia) {
                                  toast.error(
                                    mediaLimit === 1
                                      ? "Seu plano permite 1 mídia no fluxo."
                                      : `Limite de ${mediaLimit} mídias atingido.`,
                                  );
                                  return;
                                }
                                setUploadNodeId(node.id);
                                fileRef.current?.click();
                              }}
                            >
                              {uploadMutation.isPending && uploadNodeId === node.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ImagePlus className="h-4 w-4" />
                              )}
                              {nodeHasMedia ? "Trocar mídia" : "Enviar mídia"}
                            </Button>

                            {node.imageUrl && (
                              <div className="flex items-center gap-2">
                                {node.mediaType === "video" ? (
                                  <video
                                    src={node.imageUrl}
                                    className="h-12 w-20 rounded-lg border object-cover"
                                    muted
                                    playsInline
                                  />
                                ) : (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={node.imageUrl}
                                    alt=""
                                    className="h-12 rounded-lg border object-cover"
                                  />
                                )}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-medium text-gray-500">
                                    {mediaNodeLabel(node.mediaType)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      patchNode(node.id, {
                                        imageUrl: undefined,
                                        imageStoragePath: undefined,
                                        mediaType: undefined,
                                      })
                                    }
                                    className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          {!canAddMedia && !nodeHasMedia && (
                            <p className="text-[11px] text-amber-700">
                              Limite do plano atingido.{" "}
                              <Link
                                href="/plan"
                                className="font-semibold underline-offset-2 hover:underline"
                              >
                                Upgrade
                              </Link>
                            </p>
                          )}
                        </div>

                        {/* Buttons */}
                        <div className="space-y-2 border-t border-gray-50 px-4 py-3">
                          <div className="flex items-center justify-between">
                            <SectionLabel
                              icon={<MousePointerClick className="h-3.5 w-3.5" />}
                              label="Botões"
                              hint={`máx. ${LEAD_FLOW_MAX_BUTTONS}`}
                            />
                            <button
                              type="button"
                              disabled={node.buttons.length >= LEAD_FLOW_MAX_BUTTONS}
                              onClick={() =>
                                patchNode(node.id, {
                                  buttons: [
                                    ...node.buttons,
                                    { id: newLeadFlowId("btn"), label: "" },
                                  ],
                                })
                              }
                              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-brand-600 transition-colors hover:bg-brand-50 disabled:opacity-40"
                            >
                              <Plus className="h-3 w-3" />
                              Adicionar
                            </button>
                          </div>

                          {node.buttons.length === 0 ? (
                            <p className="py-1 text-[11px] text-gray-400">
                              Sem botões — mensagem sem interação clicável
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {node.buttons.map((btn, btnIndex) => (
                                <div key={btn.id} className="flex items-center gap-2">
                                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[9px] font-bold text-gray-500">
                                    {btnIndex + 1}
                                  </span>
                                  <input
                                    value={btn.label}
                                    onChange={(e) =>
                                      patchNode(node.id, {
                                        buttons: node.buttons.map((b, i) =>
                                          i === btnIndex
                                            ? { ...b, label: e.target.value }
                                            : b,
                                        ),
                                      })
                                    }
                                    maxLength={20}
                                    placeholder="Texto do botão"
                                    className="flex-1 rounded-xl border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                                  />
                                  <select
                                    value={btn.nextNodeId ?? ""}
                                    onChange={(e) =>
                                      patchNode(node.id, {
                                        buttons: node.buttons.map((b, i) =>
                                          i === btnIndex
                                            ? { ...b, nextNodeId: e.target.value || undefined }
                                            : b,
                                        ),
                                      })
                                    }
                                    className="rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-sm"
                                  >
                                    <option value="">Encerrar</option>
                                    {nodeOptions
                                      .filter((o) => o.id !== node.id)
                                      .map((o) => (
                                        <option key={o.id} value={o.id}>
                                          {o.label}
                                        </option>
                                      ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      patchNode(node.id, {
                                        buttons: node.buttons.filter((_, i) => i !== btnIndex),
                                      })
                                    }
                                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Entry keywords */}
                        <div className="space-y-2 border-t border-gray-50 px-4 py-3">
                          <SectionLabel
                            icon={<Zap className="h-3.5 w-3.5" />}
                            label="Acesso direto por palavra"
                          />
                          <input
                            value={
                              entryKeywordsDrafts[node.id] ??
                              (node.entryKeywords ?? []).join(", ")
                            }
                            onChange={(e) =>
                              setEntryKeywordsDrafts((prev) => ({
                                ...prev,
                                [node.id]: e.target.value,
                              }))
                            }
                            onBlur={() => {
                              const raw =
                                entryKeywordsDrafts[node.id] ??
                                (node.entryKeywords ?? []).join(", ");
                              patchNode(node.id, { entryKeywords: parseTriggerKeywords(raw) });
                            }}
                            placeholder="como funciona, funcionalidades"
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm transition-colors focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                          />
                          <p className="text-[11px] text-gray-400">
                            Cliente digita uma dessas palavras → abre este passo direto
                          </p>
                        </div>

                        {/* Idle reminder */}
                        <div className="border-t border-gray-50 px-4 py-3">
                          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-start gap-2">
                                <Bell className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                <div>
                                  <p className="text-xs font-semibold text-gray-900">
                                    Lembrete de silêncio
                                  </p>
                                  <p className="text-[10px] text-gray-500">
                                    1 mensagem se o cliente não responder após este passo
                                  </p>
                                </div>
                              </div>
                              <Switch
                                checked={node.idleFollowUpEnabled === true}
                                onCheckedChange={(idleFollowUpEnabled) =>
                                  patchNode(node.id, { idleFollowUpEnabled })
                                }
                              />
                            </div>
                            {node.idleFollowUpEnabled && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Label className="shrink-0 text-[11px] text-gray-600">
                                    Aguardar (minutos)
                                  </Label>
                                  <input
                                    type="number"
                                    min={5}
                                    max={1440}
                                    value={
                                      node.idleFollowUpMinutes ??
                                      DEFAULT_LEAD_FLOW_IDLE_FOLLOW_UP_MINUTES
                                    }
                                    onChange={(e) => {
                                      const n = Number(e.target.value);
                                      patchNode(node.id, {
                                        idleFollowUpMinutes: Number.isFinite(n) ? n : undefined,
                                      });
                                    }}
                                    className="w-20 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm"
                                  />
                                </div>
                                <TemplateMessageField
                                  value={
                                    node.idleFollowUpMessage ??
                                    DEFAULT_LEAD_FLOW_IDLE_FOLLOW_UP_MESSAGE
                                  }
                                  onChange={(idleFollowUpMessage) =>
                                    patchNode(node.id, { idleFollowUpMessage })
                                  }
                                  rows={2}
                                  placeholder={DEFAULT_LEAD_FLOW_IDLE_FOLLOW_UP_MESSAGE}
                                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add step button */}
            <button
              type="button"
              onClick={addNode}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 py-3 text-sm text-gray-400 transition-colors hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-600"
            >
              <Plus className="h-4 w-4" />
              Adicionar passo
            </button>
          </div>
        </div>

        {/* Right: sticky preview */}
        <div className="hidden w-[268px] shrink-0 lg:block">
          <div className="sticky top-20 space-y-3">
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
                <Smartphone className="h-4 w-4 text-brand-600" />
                <span className="text-xs font-semibold text-gray-700">Prévia ao vivo</span>
                {previewNode && (
                  <span className="ml-auto text-[10px] text-gray-400">
                    {previewNodeIndex >= 0 ? `Passo ${previewNodeIndex + 1}` : ""}
                    {flow.startNodeId === previewNode.id ? " · início" : ""}
                  </span>
                )}
              </div>
              <div className="flex justify-center px-3 py-4">
                <LeadFlowWaPreview
                  businessName={businessName}
                  text={previewNode?.text}
                  imageUrl={previewNode?.imageUrl}
                  mediaType={previewNode?.mediaType}
                  buttons={previewNode?.buttons ?? []}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Dicas rápidas
              </p>
              <ul className="space-y-1.5 text-[11px] text-gray-500">
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5 shrink-0 text-brand-400">•</span>
                  Clique no número do passo para definir como início
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5 shrink-0 text-brand-400">•</span>
                  Use{" "}
                  <code className="rounded bg-gray-200 px-1 font-mono text-[10px]">{"{nome}"}</code>{" "}
                  para o nome do cliente
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5 shrink-0 text-brand-400">•</span>
                  Até 3 botões clicáveis por passo
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="mt-0.5 shrink-0 text-brand-400">•</span>
                  Cliente digita &quot;voltar&quot; para retornar ao passo anterior
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ── Save status pill ── */}
      <div className="fixed bottom-24 right-4 z-50 sm:right-6 lg:bottom-8">
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-full px-5 py-3 text-sm font-semibold shadow-xl transition-all duration-200",
            saveMutation.isPending
              ? "bg-brand-600 text-white shadow-brand-500/30"
              : hasChanges
                ? "bg-brand-600 text-white shadow-brand-500/30"
                : saveMutation.isSuccess
                  ? "bg-emerald-500 text-white shadow-emerald-500/30"
                  : "border border-gray-200 bg-white text-gray-400 shadow-gray-200/50",
          )}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : !hasChanges && saveMutation.isSuccess ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : null}
          <span>
            {saveMutation.isPending
              ? "Salvando..."
              : editing
                ? "Digitando..."
                : hasChanges
                  ? "Alterações pendentes..."
                  : saveMutation.isSuccess
                    ? "Salvo"
                    : "Tudo salvo"}
          </span>
          {hasChanges && !saveMutation.isPending && (
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-400" />
          )}
        </div>
      </div>

      {/* ── Help button ── */}
      <button
        type="button"
        onClick={() => setHelpOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-400/40 transition-all duration-200 hover:scale-110 hover:bg-brand-700 active:scale-95"
        aria-label="Como funcionam as vendas guiadas"
      >
        <HelpCircle className="h-5 w-5" />
      </button>

      {/* ── Help modal ── */}
      {helpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="max-h-[70vh] w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-5 pb-4 pt-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50">
                  <HelpCircle className="h-4 w-4 text-brand-600" />
                </div>
                <span className="font-bold text-gray-900">Como funciona</span>
              </div>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[calc(70vh-4.5rem)] space-y-4 overflow-y-auto px-5 py-4">
              <LeadFlowHelpItem
                icon={<GitBranch className="h-4 w-4 text-brand-600" />}
                title="Exemplo de conversa"
              >
                Cliente manda{" "}
                <strong className="font-semibold text-gray-800">oi</strong> → IA envia mensagem com
                botões → cliente clica em{" "}
                <strong className="font-semibold text-gray-800">VER PRODUTOS</strong> → próximo
                passo com GIF, imagem ou vídeo e novo botão → pode encerrar ou seguir ramificando.
              </LeadFlowHelpItem>
              <LeadFlowHelpItem
                icon={<Zap className="h-4 w-4 text-brand-600" />}
                title="Quando inicia"
              >
                Na saudação, por palavras-chave (ex.:{" "}
                <em>orçamento, interesse</em>) ou no primeiro contato. Ative o toggle{" "}
                <strong className="font-semibold text-gray-800">Ativo</strong> — alterações salvam
                sozinhas.
              </LeadFlowHelpItem>
              <LeadFlowHelpItem
                icon={<Sparkles className="h-4 w-4 text-brand-600" />}
                title="Personalização"
              >
                Use{" "}
                <code className="rounded bg-gray-100 px-1 font-mono text-[11px]">{"{nome}"}</code>{" "}
                para quem conversa e{" "}
                <code className="rounded bg-gray-100 px-1 font-mono text-[11px]">
                  {"{negocio}"}
                </code>{" "}
                para o nome do negócio — arraste os blocos para dentro da mensagem.
              </LeadFlowHelpItem>
              <LeadFlowHelpItem
                icon={<ArrowLeft className="h-4 w-4 text-brand-600" />}
                title="Comandos no WhatsApp"
              >
                Cliente digita{" "}
                <strong className="font-semibold text-gray-800">voltar</strong> para retornar ao
                passo anterior. No primeiro passo, a IA avisa que já está no início. Texto fora dos
                botões recebe o aviso configurado em cada etapa.
              </LeadFlowHelpItem>
              <LeadFlowHelpItem
                icon={<Zap className="h-4 w-4 text-brand-600" />}
                title="Lembrete de silêncio"
              >
                Em <strong className="font-semibold text-gray-800">qualquer passo</strong>, ative o
                toggle para mandar 1 mensagem se o cliente ficar mudo (minutos e texto configuráveis
                por passo). Dispara só 1 vez por visita ao passo; cliente responde → cancela.
              </LeadFlowHelpItem>
              <div className="rounded-xl border border-teal-100 bg-teal-50/40 px-3.5 py-3">
                <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                  <Sparkles className="h-3.5 w-3.5 text-teal-600" />
                  Exemplo (3 passos)
                </p>
                <ol className="list-inside list-decimal space-y-1 text-sm text-gray-600">
                  <li>
                    <strong className="font-semibold text-gray-800">Passo 1:</strong> &quot;Olá{" "}
                    {"{nome}"}! Como posso ajudar?&quot; — botões: Orçamento · Suporte · Encerrar
                  </li>
                  <li>
                    <strong className="font-semibold text-gray-800">Passo 2 (Orçamento):</strong>{" "}
                    GIF ou vídeo do serviço + &quot;Veja nossos valores&quot; — botão: Quero
                    contratar
                  </li>
                  <li>
                    <strong className="font-semibold text-gray-800">Passo 3:</strong> &quot;Perfeito!
                    Um consultor fala com você em instantes.&quot; — sem botões (fim)
                  </li>
                </ol>
              </div>
              <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <MousePointerClick className="h-3.5 w-3.5" /> Até 3 botões por passo
                </span>
                <span className="inline-flex items-center gap-1">
                  <ImagePlus className="h-3.5 w-3.5" /> Imagem, GIF ou vídeo (limite do plano)
                </span>
                <span className="inline-flex items-center gap-1">
                  <ArrowLeft className="h-3.5 w-3.5" /> Comando voltar no chat
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  GitBranch,
  ImagePlus,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
  HelpCircle,
  MousePointerClick,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { businessApi } from "@/lib/api";
import { uploadLeadFlowMedia } from "@/lib/web-api/lead-flow";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { LeadCaptureFlow, LeadFlowNode } from "@flowdesk/firebase/client";
import {
  DEFAULT_LEAD_FLOW_INVALID_REPLY,
  LEAD_FLOW_MAX_BUTTONS,
  newLeadFlowId,
  normalizeLeadCaptureFlow,
  renderTemplate,
} from "@flowdesk/shared";
import { TemplateMessageField } from "@/components/business/TemplateMessageField";

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

function nodeLabel(node: LeadFlowNode, index: number) {
  const preview = node.text.trim().slice(0, 42);
  return preview ? `Passo ${index + 1}: ${preview}` : `Passo ${index + 1}`;
}

function FlowHelpItem({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-3.5 py-3">
      <p className="text-sm font-semibold text-gray-900 mb-1">{title}</p>
      <div className="text-xs text-gray-600 leading-relaxed">{children}</div>
    </div>
  );
}

export function LeadFlowEditor({ businessId, businessName, initialFlow }: Props) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadNodeId, setUploadNodeId] = useState<string | null>(null);
  const [openNodeId, setOpenNodeId] = useState<string | null>(null);
  const [flow, setFlow] = useState<LeadCaptureFlow>(() => normalizeLeadCaptureFlow(initialFlow));
  const [keywordsDraft, setKeywordsDraft] = useState(
    () => normalizeLeadCaptureFlow(initialFlow).triggerKeywords.join(", "),
  );

  useEffect(() => {
    const normalized = normalizeLeadCaptureFlow(initialFlow);
    setFlow(normalized);
    setKeywordsDraft(normalized.triggerKeywords.join(", "));
  }, [initialFlow]);

  const nodeOptions = useMemo(
    () => flow.nodes.map((n, i) => ({ id: n.id, label: nodeLabel(n, i) })),
    [flow.nodes],
  );

  const saveMutation = useMutation({
    mutationFn: () => {
      const triggerKeywords = parseTriggerKeywords(keywordsDraft);
      return businessApi.update(businessId, {
        leadFlow: normalizeLeadCaptureFlow({ ...flow, triggerKeywords }),
      } as Record<string, unknown>);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["business", businessId] });
      toast.success("Fluxo salvo!");
    },
    onError: () => toast.error("Erro ao salvar fluxo"),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ nodeId, file }: { nodeId: string; file: File }) =>
      uploadLeadFlowMedia(businessId, file),
    onSuccess: (saved, { nodeId }) => {
      setFlow((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, imageUrl: saved.mediaUrl, imageStoragePath: saved.mediaStoragePath }
            : n,
        ),
      }));
      toast.success("Imagem enviada!");
    },
    onError: () => toast.error("Erro ao enviar imagem"),
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
          invalidReply: DEFAULT_LEAD_FLOW_INVALID_REPLY,
          buttons: [],
        },
      ],
    }));
    setOpenNodeId(id);
  }

  function removeNode(nodeId: string) {
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
    if (!file.type.startsWith("image/")) {
      toast.error("Use JPEG, PNG ou WebP");
      return;
    }
    uploadMutation.mutate({ nodeId, file });
  }

  const previewStart = flow.nodes.find((n) => n.id === flow.startNodeId) ?? flow.nodes[0];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Fluxo conversacional</h2>
            <p className="text-sm text-gray-500 mt-1">
              Defina mensagens, botões e imagens que a IA envia no WhatsApp.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Label className="text-sm text-gray-600">
              Ativo
            </Label>
            <Switch
              checked={flow.enabled}
              onCheckedChange={(enabled) => patchFlow({ enabled })}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Iniciar na saudação</p>
                <p className="text-xs text-gray-500">Quando o cliente mandar oi, entra no fluxo</p>
              </div>
              <Switch
                checked={flow.startOnGreeting}
                onCheckedChange={(startOnGreeting) => patchFlow({ startOnGreeting })}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Palavras que também iniciam o fluxo</Label>
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
                className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-gray-400">Separe as palavras com vírgula</p>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-2">
              Prévia WhatsApp
            </p>
            <div className="rounded-2xl bg-[#0b141a] p-3 min-h-[140px] space-y-2">
              <div className="text-[11px] text-emerald-200/80 text-center">{businessName}</div>
              {previewStart?.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewStart.imageUrl}
                  alt=""
                  className="max-h-28 rounded-lg mx-auto object-contain"
                />
              )}
              {previewStart?.text && (
                <div className="max-w-[90%] rounded-xl rounded-tl-sm bg-[#202c33] px-3 py-2 text-xs text-white">
                  {renderTemplate(previewStart.text, { nome: "Maria", negocio: businessName })}
                </div>
              )}
              {previewStart?.buttons.map((b) => (
                <div
                  key={b.id}
                  className="max-w-[90%] rounded-lg border border-[#2a3942] bg-[#182229] px-3 py-2 text-xs text-[#53bdeb] text-center"
                >
                  ↩ {b.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-brand-100 bg-brand-50/40 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-brand-600 shrink-0" />
          <h3 className="text-sm font-semibold text-gray-900">Como funciona</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <FlowHelpItem title="Exemplo de conversa">
            Cliente manda <strong className="font-medium text-gray-800">oi</strong> → IA envia mensagem com
            botões → cliente clica em <strong className="font-medium text-gray-800">VER PRODUTOS</strong> →
            próximo passo com imagem e novo botão → pode encerrar ou seguir ramificando.
          </FlowHelpItem>
          <FlowHelpItem title="Quando inicia">
            Na saudação, por palavras-chave (ex.: <em>orçamento, interesse</em>) ou quando você ativar o fluxo
            manualmente no primeiro contato. Use o toggle <strong className="font-medium text-gray-800">Ativo</strong>{" "}
            e clique em <strong className="font-medium text-gray-800">Salvar fluxo</strong>.
          </FlowHelpItem>
          <FlowHelpItem title="Personalização">
            Use <code className="rounded bg-white px-1 font-mono text-[11px]">{"{nome}"}</code> para quem
            conversa e <code className="rounded bg-white px-1 font-mono text-[11px]">{"{negocio}"}</code>{" "}
            para o nome do seu negócio — arraste os blocos para dentro da mensagem.
          </FlowHelpItem>
          <FlowHelpItem title="Comandos no WhatsApp">
            Cliente digita <strong className="font-medium text-gray-800">voltar</strong> para retornar ao passo
            anterior. No primeiro passo, a IA avisa que já está no início. Texto solto fora dos botões recebe
            o aviso configurado em cada etapa.
          </FlowHelpItem>
        </div>
        <div className="rounded-xl border border-teal-100 bg-white/80 px-3.5 py-3 text-xs text-gray-600 leading-relaxed">
          <p className="font-semibold text-gray-900 mb-1.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            Exemplo de fluxo (3 passos)
          </p>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              <strong className="font-medium text-gray-800">Passo 1:</strong> &quot;Olá {"{nome}"}! Como posso
              ajudar?&quot; — botões: Orçamento · Suporte · Encerrar
            </li>
            <li>
              <strong className="font-medium text-gray-800">Passo 2 (Orçamento):</strong> imagem do serviço +
              &quot;Veja nossos valores&quot; — botão: Quero contratar
            </li>
            <li>
              <strong className="font-medium text-gray-800">Passo 3:</strong> &quot;Perfeito! Um consultor fala
              com você em instantes.&quot; — sem botões (fim do fluxo)
            </li>
          </ol>
        </div>
        <div className="flex flex-wrap gap-3 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1">
            <MousePointerClick className="w-3.5 h-3.5" /> Até 3 botões por passo
          </span>
          <span className="inline-flex items-center gap-1">
            <ImagePlus className="w-3.5 h-3.5" /> Imagens no Firebase Storage
          </span>
          <span className="inline-flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Comando voltar no chat
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-brand-600" />
            Passos do fluxo
          </h3>
          <Button type="button" variant="outline" size="sm" onClick={addNode} className="rounded-xl">
            <Plus className="w-4 h-4" />
            Novo passo
          </Button>
        </div>

        {flow.nodes.map((node, index) => {
          const open = openNodeId === node.id;
          return (
            <div key={node.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-1 px-2 py-1">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenNodeId(open ? null : node.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenNodeId(open ? null : node.id);
                    }
                  }}
                  className="flex-1 flex items-center gap-3 px-2 py-2 text-left rounded-xl hover:bg-gray-50 min-w-0 cursor-pointer"
                >
                  <span className="flex-1 text-sm font-medium text-gray-900 truncate">
                    {nodeLabel(node, index)}
                    {flow.startNodeId === node.id && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-brand-600 font-bold">
                        início
                      </span>
                    )}
                  </span>
                  {open ? (
                    <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => moveNode(node.id, -1)}
                >
                  <ChevronUp className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => moveNode(node.id, 1)}
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </div>

              {open && (
                <div className="border-t border-gray-100 p-4 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={flow.startNodeId === node.id ? "default" : "outline"}
                      size="sm"
                      className="rounded-xl"
                      onClick={() => patchFlow({ startNodeId: node.id })}
                    >
                      Definir como início
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => {
                        if (flow.nodes.length <= 1) {
                          toast.error("Precisa de ao menos um passo");
                          return;
                        }
                        if (confirm("Remover este passo?")) removeNode(node.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                      Remover
                    </Button>
                  </div>

                  <div>
                    <Label className="text-xs text-gray-500">Mensagem</Label>
                    <div className="mt-1.5">
                      <TemplateMessageField
                        value={node.text}
                        onChange={(text) => patchNode(node.id, { text })}
                        rows={3}
                        placeholder="Texto enviado com os botões..."
                        className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-gray-500">Imagem (opcional)</Label>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        if (uploadNodeId) onPickFile(uploadNodeId, file);
                        e.target.value = "";
                        setUploadNodeId(null);
                      }}
                    />
                    <div className="mt-1.5 flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        disabled={uploadMutation.isPending}
                        onClick={() => {
                          setUploadNodeId(node.id);
                          fileRef.current?.click();
                        }}
                      >
                        {uploadMutation.isPending && uploadNodeId === node.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ImagePlus className="w-4 h-4" />
                        )}
                        Enviar imagem
                      </Button>
                      {node.imageUrl && (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={node.imageUrl} alt="" className="h-16 rounded-lg border object-cover" />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() =>
                              patchNode(node.id, { imageUrl: undefined, imageStoragePath: undefined })
                            }
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-gray-500">Se o cliente digitar texto em vez de clicar</Label>
                    <div className="mt-1.5">
                      <TemplateMessageField
                        value={node.invalidReply ?? ""}
                        onChange={(invalidReply) => patchNode(node.id, { invalidReply })}
                        rows={2}
                        className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-gray-500">
                        Botões (máx. {LEAD_FLOW_MAX_BUTTONS})
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-xl h-7"
                        disabled={node.buttons.length >= LEAD_FLOW_MAX_BUTTONS}
                        onClick={() =>
                          patchNode(node.id, {
                            buttons: [
                              ...node.buttons,
                              { id: newLeadFlowId("btn"), label: "" },
                            ],
                          })
                        }
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Botão
                      </Button>
                    </div>
                    {node.buttons.map((btn, btnIndex) => (
                      <div key={btn.id} className="grid gap-2 md:grid-cols-[1fr_1fr_auto] items-center">
                        <input
                          value={btn.label}
                          onChange={(e) =>
                            patchNode(node.id, {
                              buttons: node.buttons.map((b, i) =>
                                i === btnIndex ? { ...b, label: e.target.value } : b,
                              ),
                            })
                          }
                          maxLength={20}
                          placeholder="Texto do botão"
                          className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
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
                          className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
                        >
                          <option value="">Encerrar fluxo</option>
                          {nodeOptions
                            .filter((o) => o.id !== node.id)
                            .map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.label}
                              </option>
                            ))}
                        </select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-gray-400 hover:text-red-500"
                          onClick={() =>
                            patchNode(node.id, {
                              buttons: node.buttons.filter((_, i) => i !== btnIndex),
                            })
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className={cn("w-full md:w-auto rounded-xl h-11 px-6")}
      >
        {saveMutation.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        Salvar fluxo
      </Button>
    </div>
  );
}

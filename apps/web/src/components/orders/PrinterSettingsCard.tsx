"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { businessApi, whatsappApi, printerApi } from "@/lib/api";
import { toast } from "sonner";
import { Printer, Loader2, Save, Wifi, Info, ChevronDown, Copy, Check, Usb, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { normalizePrinterConfig, DEFAULT_PRINTER_PORT } from "@flowdesk/shared";
import type { PrinterConfig } from "@flowdesk/firebase/client";

const AGENT_ONLINE_WINDOW_MS = 2 * 60_000;

export function PrinterSettingsCard({ businessId }: { businessId: string }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [pairingToken, setPairingToken] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: business } = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => businessApi.get(businessId),
    enabled: !!businessId,
    refetchInterval: expanded ? 15_000 : false,
  });

  const [cfg, setCfg] = useState<PrinterConfig | null>(null);
  const active = cfg ?? normalizePrinterConfig((business as { printerConfig?: PrinterConfig } | undefined)?.printerConfig);
  const isUsb = active.connectionType === "usb";
  const agentOnline = Boolean(
    active.agentLastSeenAt && Date.now() - Date.parse(active.agentLastSeenAt) < AGENT_ONLINE_WINDOW_MS,
  );

  const saveMutation = useMutation({
    mutationFn: (next: PrinterConfig) =>
      businessApi.update(businessId, { printerConfig: normalizePrinterConfig(next) } as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business", businessId] });
      toast.success("Configuração de impressão salva!");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar"),
  });

  const testMutation = useMutation({
    mutationFn: () => whatsappApi.testPrinter(businessId),
    onSuccess: () => toast.success("Teste enviado! Verifique se saiu na impressora."),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Não foi possível imprimir o teste"),
  });

  const pairMutation = useMutation({
    mutationFn: () => printerApi.generateAgentToken(businessId),
    onSuccess: ({ token }) => {
      setPairingToken(token);
      queryClient.invalidateQueries({ queryKey: ["business", businessId] });
      toast.success("Código de pareamento gerado!");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao gerar código"),
  });

  function update(patch: Partial<PrinterConfig>) {
    setCfg({ ...active, ...patch });
  }

  async function copyToken() {
    try {
      await navigator.clipboard.writeText(pairingToken);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm mb-6 overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              active.enabled ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-400",
            )}
          >
            <Printer className="h-5 w-5" />
          </div>
          <div className="min-w-0 text-left">
            <p className="text-sm font-semibold text-gray-900">Impressão automática de pedidos</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {active.enabled
                ? isUsb
                  ? `Ativada — via agente local (${agentOnline ? "online" : "offline"})`
                  : `Ativada — imprime na impressora ${active.ip || "(sem IP configurado)"}`
                : "Desativada — clique para configurar"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={active.enabled}
            onCheckedChange={(enabled) => {
              const next = { ...active, enabled };
              setCfg(next);
              saveMutation.mutate(next);
            }}
          />
          <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform", expanded && "rotate-180")} />
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={isUsb ? "outline" : "default"}
              size="sm"
              onClick={() => update({ connectionType: "network" })}
              className="gap-1.5"
            >
              <Wifi className="w-4 h-4" />
              Rede (IP)
            </Button>
            <Button
              type="button"
              variant={isUsb ? "default" : "outline"}
              size="sm"
              onClick={() => update({ connectionType: "usb" })}
              className="gap-1.5"
            >
              <Usb className="w-4 h-4" />
              USB (agente local)
            </Button>
          </div>

          {isUsb ? (
            <>
              <div className="flex items-start gap-2.5 rounded-xl bg-blue-50 border border-blue-100 px-3.5 py-3">
                <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 leading-relaxed">
                  <strong>Como funciona:</strong> instale a impressora normalmente no computador do caixa (driver
                  do fabricante, como qualquer impressora do Windows/Mac). Depois baixe e rode o agente local do
                  FlowDeskIA nesse mesmo computador, colando o código de pareamento abaixo. A partir daí, os
                  cupons chegam automaticamente para o agente imprimir — pode levar alguns segundos, ao contrário
                  da impressora de rede.
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 px-3.5 py-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Agente local
                  </span>
                  <span
                    className={cn(
                      "text-xs font-semibold px-2 py-0.5 rounded-full",
                      agentOnline ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500",
                    )}
                  >
                    {agentOnline ? "Conectado" : active.agentToken ? "Offline" : "Nunca pareado"}
                  </span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => pairMutation.mutate()}
                  disabled={pairMutation.isPending}
                  className="gap-1.5"
                >
                  {pairMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <KeyRound className="w-4 h-4" />
                  )}
                  {active.agentToken ? "Gerar novo código de pareamento" : "Gerar código de pareamento"}
                </Button>

                {pairingToken && (
                  <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                    <code className="flex-1 text-xs text-gray-800 break-all">{pairingToken}</code>
                    <Button type="button" variant="ghost" size="sm" onClick={() => void copyToken()} className="gap-1">
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                )}

                {active.agentPrinters && active.agentPrinters.length > 0 && (
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      Impressora
                    </Label>
                    <select
                      className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm bg-white"
                      value={active.agentPrinterName ?? ""}
                      onChange={(e) => update({ agentPrinterName: e.target.value })}
                    >
                      <option value="" disabled>
                        Selecione uma impressora
                      </option>
                      {active.agentPrinters.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Cópias</Label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  className="mt-2 w-32 rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                  value={active.copies}
                  onChange={(e) => update({ copies: Number(e.target.value) || 1 })}
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2.5 rounded-xl bg-blue-50 border border-blue-100 px-3.5 py-3">
                <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 leading-relaxed">
                  <strong>Como funciona:</strong> quando ativada, a IA imprime automaticamente um cupom com os itens,
                  total, entrega/retirada e forma de pagamento assim que o cliente finaliza o pedido no WhatsApp —
                  sem precisar abrir o painel. Funciona com a mesma impressora térmica de comanda/cozinha usada em
                  delivery, desde que ela esteja conectada à rede com IP fixo e a porta liberada no roteador
                  (geralmente a <strong>9100</strong>). Se você não sabe o IP da sua impressora, peça ao técnico que
                  instalou ou consulte o manual dela.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    IP da impressora
                  </Label>
                  <input
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                    value={active.ip}
                    onChange={(e) => update({ ip: e.target.value })}
                    placeholder="Ex: 192.168.0.50"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Porta</Label>
                  <input
                    type="number"
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                    value={active.port}
                    onChange={(e) => update({ port: Number(e.target.value) || DEFAULT_PRINTER_PORT })}
                    placeholder={String(DEFAULT_PRINTER_PORT)}
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Cópias</Label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                    value={active.copies}
                    onChange={(e) => update({ copies: Number(e.target.value) || 1 })}
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <Button
              type="button"
              onClick={() => saveMutation.mutate(active)}
              disabled={saveMutation.isPending}
              className="gap-1.5"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar configuração
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => testMutation.mutate()}
              disabled={
                testMutation.isPending || (isUsb ? !active.agentPrinterName : !active.ip.trim())
              }
              className="gap-1.5"
            >
              {testMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
              Testar impressora
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

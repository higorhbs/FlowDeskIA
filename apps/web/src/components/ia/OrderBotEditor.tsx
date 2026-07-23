"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { businessApi } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Save, Plus, Trash2, Truck, Store, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { OrderBotConfig } from "@flowdesk/firebase/client";
import { normalizeOrderBotConfig, DEFAULT_ORDER_TRIGGER_KEYWORDS } from "@flowdesk/shared";
import { TemplateMessageField, type TemplateVariable } from "@/components/business/TemplateMessageField";

type Props = {
  businessId: string;
  businessName: string;
  initialConfig?: OrderBotConfig | null;
};

const START_VARS: readonly TemplateVariable[] = [
  { token: "{nome}", label: "Nome do cliente", shortHint: "Cliente" },
  { token: "{negocio}", label: "Nome do negócio", shortHint: "Negócio" },
];

const CONFIRM_VARS: readonly TemplateVariable[] = [
  { token: "{itens}", label: "Lista dos itens pedidos", shortHint: "Itens" },
  { token: "{total}", label: "Valor total do pedido", shortHint: "Total" },
  { token: "{entrega}", label: "Entrega ou retirada", shortHint: "Entrega/Retirada" },
  { token: "{pagamento}", label: "Forma de pagamento escolhida", shortHint: "Pagamento" },
  { token: "{codigo}", label: "Código do pedido", shortHint: "Código" },
  { token: "{nome}", label: "Nome do cliente", shortHint: "Cliente" },
  { token: "{negocio}", label: "Nome do negócio", shortHint: "Negócio" },
];

export function OrderBotEditor({ businessId, businessName, initialConfig }: Props) {
  const queryClient = useQueryClient();
  const [cfg, setCfg] = useState<OrderBotConfig>(() => normalizeOrderBotConfig(initialConfig));
  const [keywordsDraft, setKeywordsDraft] = useState(() => {
    const normalized = normalizeOrderBotConfig(initialConfig);
    const k = normalized.triggerKeywords.length ? normalized.triggerKeywords : DEFAULT_ORDER_TRIGGER_KEYWORDS;
    return k.join(", ");
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const normalized = normalizeOrderBotConfig({
        ...cfg,
        triggerKeywords: keywordsDraft.split(",").map((k) => k.trim()).filter(Boolean),
      });
      return businessApi.update(businessId, { orderBot: normalized } as Record<string, unknown>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business", businessId] });
      toast.success("Configuração de pedidos salva!");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erro ao salvar"),
  });

  function updatePaymentMethod(index: number, value: string) {
    setCfg((prev) => ({
      ...prev,
      paymentMethods: prev.paymentMethods.map((m, i) => (i === index ? value : m)),
    }));
  }

  function removePaymentMethod(index: number) {
    setCfg((prev) => ({
      ...prev,
      paymentMethods: prev.paymentMethods.length <= 1 ? prev.paymentMethods : prev.paymentMethods.filter((_, i) => i !== index),
    }));
  }

  function addPaymentMethod() {
    setCfg((prev) => ({ ...prev, paymentMethods: [...prev.paymentMethods, ""] }));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50">
            <Store className="h-6 w-6 text-brand-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">Pedidos</h2>
            <p className="mt-1 text-sm text-gray-500">
              A IA usa o cardápio de hoje (aba Cardápio Semanal) pra conduzir o cliente até fechar o pedido —
              itens, entrega/retirada, endereço e forma de pagamento.
            </p>
          </div>
          <Switch
            checked={cfg.enabled}
            onCheckedChange={(enabled) => setCfg((prev) => ({ ...prev, enabled }))}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-5">
        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Palavras que iniciam o pedido
          </Label>
          <input
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
            value={keywordsDraft}
            onChange={(e) => setKeywordsDraft(e.target.value)}
            placeholder={DEFAULT_ORDER_TRIGGER_KEYWORDS.join(", ")}
          />
          <p className="mt-1.5 text-xs text-gray-400">
            Ex: pedido, fazer pedido, delivery — separadas por vírgula
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-medium text-gray-900">
              <Truck className="h-4 w-4 text-gray-400" />
              Entrega
            </span>
            <Switch
              checked={cfg.fulfillmentDelivery}
              onCheckedChange={(v) =>
                setCfg((prev) => ({
                  ...prev,
                  fulfillmentDelivery: v,
                  ...(!v && !prev.fulfillmentPickup ? { fulfillmentPickup: true } : {}),
                }))
              }
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-medium text-gray-900">
              <Store className="h-4 w-4 text-gray-400" />
              Retirada no local
            </span>
            <Switch
              checked={cfg.fulfillmentPickup}
              onCheckedChange={(v) =>
                setCfg((prev) => ({
                  ...prev,
                  fulfillmentPickup: v,
                  ...(!v && !prev.fulfillmentDelivery ? { fulfillmentDelivery: true } : {}),
                }))
              }
            />
          </div>
        </div>

        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Formas de pagamento
          </Label>
          <div className="mt-2 space-y-2">
            {cfg.paymentMethods.map((method, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  value={method}
                  onChange={(e) => updatePaymentMethod(i, e.target.value)}
                  placeholder={`Forma de pagamento ${i + 1}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removePaymentMethod(i)}
                  disabled={cfg.paymentMethods.length <= 1}
                  className="h-9 w-9 border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={addPaymentMethod}
            className="mt-2 text-xs text-brand-700 hover:text-brand-900 border-brand-200 bg-brand-50 h-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar forma de pagamento
          </Button>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-medium text-amber-950">
                <ShieldCheck className="h-4 w-4" />
                Confirmar pedidos manualmente
              </p>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                {cfg.requiresApproval
                  ? "Ativo: pedido fica aguardando até você confirmar na aba Pedidos."
                  : "Desligado: pedido já entra confirmado, sem esperar sua aprovação."}
              </p>
            </div>
            <Switch
              checked={cfg.requiresApproval}
              onCheckedChange={(requiresApproval) => setCfg((prev) => ({ ...prev, requiresApproval }))}
            />
          </div>
        </div>

        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Mensagem inicial (mostra o cardápio de hoje em seguida)
          </Label>
          <div className="mt-2">
            <TemplateMessageField
              value={cfg.startMessage}
              onChange={(startMessage) => setCfg((prev) => ({ ...prev, startMessage }))}
              rows={4}
              variables={START_VARS}
            />
          </div>
        </div>

        <div>
          <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">
            {cfg.requiresApproval ? "Mensagem enquanto aguarda confirmação" : "Mensagem de pedido confirmado"}
          </Label>
          <div className="mt-2">
            <TemplateMessageField
              value={cfg.requiresApproval ? cfg.awaitingMessage : cfg.completedMessage}
              onChange={(msg) =>
                setCfg((prev) =>
                  prev.requiresApproval ? { ...prev, awaitingMessage: msg } : { ...prev, completedMessage: msg },
                )
              }
              rows={7}
              variables={CONFIRM_VARS}
            />
          </div>
        </div>
      </div>

      <Button
        type="button"
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="shadow-sm"
      >
        {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Salvar configuração
      </Button>
    </div>
  );
}

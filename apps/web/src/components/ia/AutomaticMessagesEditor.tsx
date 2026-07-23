"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { businessApi } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Save, MessageCircle, DoorClosed } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  TemplateMessageField,
  TemplateVariablesHelp,
} from "@/components/business/TemplateMessageField";
import { WhatsAppMessagePreview, type PreviewMessage } from "@/components/business/WhatsAppMessagePreview";

function renderPreviewTemplate(text: string, businessName: string) {
  return text.replaceAll("{nome}", "Maria").replaceAll("{negocio}", businessName.trim() || "seu negócio");
}

function CharCount({ value, max }: { value: string; max: number }) {
  const len = value?.length ?? 0;
  return (
    <span className={cn("text-[11px] tabular-nums", len > max * 0.8 ? "text-amber-500" : "text-gray-400")}>
      {len}/{max}
    </span>
  );
}

export function AutomaticMessagesEditor({
  businessId,
  businessName,
  initialGreetingEnabled,
  initialGreetingMsg,
  initialAwayMsg,
}: {
  businessId: string;
  businessName: string;
  initialGreetingEnabled: boolean;
  initialGreetingMsg: string;
  initialAwayMsg: string;
}) {
  const queryClient = useQueryClient();
  const [greetingEnabled, setGreetingEnabled] = useState(initialGreetingEnabled);
  const [greetingMsg, setGreetingMsg] = useState(initialGreetingMsg);
  const [awayMsg, setAwayMsg] = useState(initialAwayMsg);
  const [previewMode, setPreviewMode] = useState<"greeting" | "away">("greeting");

  const saveMutation = useMutation({
    mutationFn: () =>
      businessApi.update(businessId, {
        greetingEnabled,
        greetingMsg: greetingMsg.trim() || "Olá! Como posso ajudar?",
        awayMsg: awayMsg.trim() || "No momento estamos fechados. Em breve retornaremos!",
      } as Record<string, unknown>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business", businessId] });
      toast.success("Mensagens automáticas salvas!");
    },
    onError: () => toast.error("Erro ao salvar mensagens"),
  });

  const previewMessages: PreviewMessage[] = [
    { from: "customer", text: previewMode === "greeting" ? "Oi, boa tarde!" : "Vocês estão abertos agora?" },
    {
      from: "bot",
      text: renderPreviewTemplate(previewMode === "greeting" ? greetingMsg : awayMsg, businessName),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50">
            <MessageCircle className="h-6 w-6 text-violet-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">Mensagens automáticas</h2>
            <p className="mt-1 text-sm text-gray-500">Boas-vindas e respostas fora do expediente</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_260px] lg:items-start">
        <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <TemplateVariablesHelp />

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-gray-700">
                <MessageCircle className="w-3.5 h-3.5 text-gray-400" />
                Mensagem de boas-vindas
              </p>
              <Switch checked={greetingEnabled} onCheckedChange={setGreetingEnabled} />
            </div>
            {greetingEnabled && (
              <>
                <TemplateMessageField
                  value={greetingMsg}
                  onChange={setGreetingMsg}
                  rows={4}
                  maxLength={500}
                  placeholder="Olá {nome}! Bem-vindo ao {negocio}. Como posso ajudar?"
                  footer={
                    <div className="flex justify-end">
                      <CharCount value={greetingMsg} max={500} />
                    </div>
                  }
                />
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Enviada na primeira interação do cliente
                </p>
              </>
            )}
          </div>

          <div className="h-px bg-gray-100" />

          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-gray-700">
              <DoorClosed className="w-3.5 h-3.5 text-gray-400" />
              Mensagem fora do horário
            </p>
            <TemplateMessageField
              value={awayMsg}
              onChange={setAwayMsg}
              rows={4}
              maxLength={500}
              placeholder="Olá {nome}! No momento estamos fechados. Retornaremos em breve!"
              footer={
                <div className="flex justify-end">
                  <CharCount value={awayMsg} max={500} />
                </div>
              }
            />
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Enviada quando o cliente escreve fora do expediente
            </p>
          </div>
        </div>

        <div className="lg:sticky lg:top-6 space-y-2.5">
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Como o cliente vê</p>
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

      <Button
        type="button"
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="shadow-sm"
      >
        {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Salvar mensagens
      </Button>
    </div>
  );
}

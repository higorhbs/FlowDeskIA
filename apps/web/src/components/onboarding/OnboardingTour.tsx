"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { tenantApi } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useAppRouter } from "@/lib/app-navigation";
import { CREATE_BUSINESS_PATH } from "@/components/business/RequireBusinessGate";
import {
  CheckCircle2, ChevronLeft, ChevronRight,
  CalendarClock, BookOpen, HelpCircle, GitBranch,
  Clock, Users, TrendingUp, Star, MessageSquareText, Zap,
  QrCode, Banknote, Wallet, ImageIcon, MousePointerClick,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IaIcon } from "@/lib/ia-brand";
import { useIsMobile } from "@/hooks/use-is-mobile";

interface ChatMsg {
  from: "customer" | "ia";
  text: string;
  time: string;
}

interface StepDef {
  badge: string;
  title: string;
  subtitle: string;
  color: string;
  accentColor: string;
  features: { icon: React.ComponentType<{ className?: string }>; text: string }[];
  chat: { businessName: string; messages: ChatMsg[] };
}

const DEMO_BUSINESS = "Horizonte Serviços";

const STEPS: StepDef[] = [
  {
    badge: "Atendimento automático",
    title: "Seu WhatsApp trabalhando 24h por dia",
    subtitle: "A IA responde instantaneamente com menu, vendas guiadas e respostas automáticas — mesmo quando você dorme.",
    color: "from-brand-500 to-brand-700",
    accentColor: "bg-brand-600",
    features: [
      { icon: Clock, text: "Respostas imediatas fora do horário" },
      { icon: IaIcon, text: "Menu configurável com até 4 opções" },
      { icon: GitBranch, text: "Vendas guiadas com botões e imagens no WhatsApp" },
      { icon: Star, text: "Experiência profissional para o cliente" },
    ],
    chat: {
      businessName: DEMO_BUSINESS,
      messages: [
        { from: "customer", text: "Oi, boa noite! Vocês ainda atendem?", time: "21:42" },
        {
          from: "ia",
          text: `Olá! 👋 Sou o assistente da *${DEMO_BUSINESS}*\n\nComo posso ajudar?\n\n*1* — 📅 Agendamentos/Pedidos\n*2* — 🛍️ Produtos\n*3* — ❓ Dúvidas\n*0* — 👤 Falar com atendente`,
          time: "21:42",
        },
      ],
    },
  },
  {
    badge: "Vendas guiadas",
    title: "Conduza o cliente com botões e imagens",
    subtitle:
      "Monte passos no painel (IA → Vendas guiadas): mensagem, botões clicáveis e fotos. Cada resposta leva ao próximo passo — perfeito para captar leads e vender no automático.",
    color: "from-teal-500 to-cyan-700",
    accentColor: "bg-teal-600",
    features: [
      { icon: MousePointerClick, text: "Até 3 botões por passo no WhatsApp" },
      { icon: ImageIcon, text: "Imagens salvas e enviadas em cada etapa" },
      { icon: GitBranch, text: "Ramificações e comando voltar no chat" },
    ],
    chat: {
      businessName: DEMO_BUSINESS,
      messages: [
        { from: "customer", text: "Oi, quero saber mais", time: "15:02" },
        {
          from: "ia",
          text: `Olá! 👋 Sou da *${DEMO_BUSINESS}*\n\nComo posso te ajudar hoje?\n\n↩ VER PRODUTOS\n↩ FALAR COM VENDAS\n↩ SUPORTE`,
          time: "15:02",
        },
        { from: "customer", text: "VER PRODUTOS", time: "15:03" },
        {
          from: "ia",
          text: "Ótimo, {nome}! Confira nossa linha completa 👇\n\n↩ QUERO ORÇAMENTO\n↩ VOLTAR",
          time: "15:03",
        },
      ],
    },
  },
  {
    badge: "Agendamentos",
    title: "Clientes agendam sem precisar ligar",
    subtitle: "A IA guia o cliente pelo fluxo completo: escolha do serviço, data disponível e confirmação — tudo via WhatsApp.",
    color: "from-blue-500 to-blue-700",
    accentColor: "bg-blue-600",
    features: [
      { icon: CalendarClock, text: "Agenda em tempo real, sem conflitos" },
      { icon: CheckCircle2, text: "Confirmação automática por mensagem" },
      { icon: Users, text: "Histórico completo no painel" },
    ],
    chat: {
      businessName: DEMO_BUSINESS,
      messages: [
        { from: "customer", text: "1", time: "10:05" },
        { from: "ia", text: "Qual serviço deseja?\n\n*1* — 📋 Serviço Básico  R$ 40\n*2* — ⭐ Serviço Padrão  R$ 55\n*3* — ✨ Pacote Completo  R$ 80", time: "10:05" },
        { from: "customer", text: "1", time: "10:06" },
        { from: "ia", text: "Disponibilidade:\n\n▸ Seg 02/06 — 09h, 11h, 14h\n▸ Ter 03/06 — 10h, 15h, 17h\n\nQual prefere?", time: "10:06" },
        { from: "customer", text: "terça 10h", time: "10:07" },
        { from: "ia", text: "✅ Agendado!\n\n📅 Terça, 03/06 às 10:00\n📋 Serviço Básico\n\nAté lá! ✨", time: "10:07" },
      ],
    },
  },
  {
    badge: "Produtos",
    title: "Seus produtos sempre atualizados no chat",
    subtitle: "Produtos e preços apresentados direto no WhatsApp. O cliente vê tudo e já agenda ou pede em seguida.",
    color: "from-purple-500 to-purple-700",
    accentColor: "bg-purple-600",
    features: [
      { icon: BookOpen, text: "Produtos sincronizados com o painel" },
      { icon: TrendingUp, text: "Clientes visualizam e já agendam" },
      { icon: Star, text: "Fotos, descrições e preços" },
    ],
    chat: {
      businessName: DEMO_BUSINESS,
      messages: [
        { from: "customer", text: "2", time: "14:30" },
        {
          from: "ia",
          text: "🛍️ *Nossos Produtos*\n\n📋 *Produto Básico*\nAtendimento rápido e objetivo\n💰 R$ 40,00\n\n⭐ *Produto Padrão*\nMais tempo e atenção ao detalhe\n💰 R$ 55,00\n\n✨ *Pacote Completo*\nExperiência completa com desconto\n💰 R$ 80,00\n\nDigite *1* para agendar!",
          time: "14:30",
        },
      ],
    },
  },
  {
    badge: "Pagamentos PIX",
    title: "Clientes pagam com PIX direto no WhatsApp",
    subtitle: "A IA gera uma cobrança PIX no momento do pedido, o cliente paga no app do banco e a confirmação chega automática — sem links externos, sem atrito.",
    color: "from-emerald-500 to-emerald-700",
    accentColor: "bg-emerald-600",
    features: [
      { icon: QrCode, text: "PIX gerado e enviado direto no chat" },
      { icon: CheckCircle2, text: "Confirmação automática quando pago" },
      { icon: Wallet, text: "Dinheiro cai na sua conta Mercado Pago na hora" },
    ],
    chat: {
      businessName: DEMO_BUSINESS,
      messages: [
        { from: "customer", text: "Quero pagar pelo WhatsApp mesmo", time: "11:20" },
        {
          from: "ia",
          text: "💰 Cobrança PIX gerada!\n\n💵 *R$ 80,00* — Pacote Completo\n\nCopie o código abaixo e cole no app do seu banco 👇\n\n`00020126580014BR.GOV.BCB.PIX0136...`\n\n⏰ Válido por 1 hora",
          time: "11:20",
        },
        { from: "customer", text: "Paguei!", time: "11:23" },
        {
          from: "ia",
          text: `✅ *Pagamento confirmado!*\n\nRecebemos R$ 80,00 com sucesso 🙌\n\nAté terça-feira, 03/06 às 10h!\n✨ ${DEMO_BUSINESS}`,
          time: "11:23",
        },
      ],
    },
  },
  {
    badge: "Perguntas & Respostas",
    title: "A IA resolve dúvidas na hora certa",
    subtitle: "Cadastre as perguntas mais frequentes. A IA identifica palavras-chave e responde automaticamente, transferindo ao atendente quando necessário.",
    color: "from-amber-500 to-orange-600",
    accentColor: "bg-amber-500",
    features: [
      { icon: HelpCircle, text: "Busca por palavras-chave inteligente" },
      { icon: MessageSquareText, text: "Respostas personalizadas por dúvida" },
      { icon: Users, text: "Passa ao atendente quando necessário" },
    ],
    chat: {
      businessName: DEMO_BUSINESS,
      messages: [
        { from: "customer", text: "Aceita cartão de crédito?", time: "16:15" },
        {
          from: "ia",
          text: "💳 Sim! Aceitamos:\n\n• Cartão de crédito e débito\n• PIX (5% de desconto!)\n• Dinheiro\n\nTem mais alguma dúvida? 😊",
          time: "16:15",
        },
        { from: "customer", text: "Qual o endereço?", time: "16:16" },
        {
          from: "ia",
          text: "📍 Rua das Flores, 123 — Centro\n\n🕐 Horários:\nSeg–Sex: 9h às 20h\nSáb: 9h às 18h",
          time: "16:16",
        },
      ],
    },
  },
];

function parseWaText(text: string) {
  const lines = text.split("\n");
  return lines.map((line, li) => {
    const tokens = line.split(/(\*[^*]+\*|_[^_]+_)/g);
    return (
      <span key={li}>
        {tokens.map((t, i) => {
          if (t.startsWith("*") && t.endsWith("*"))
            return <strong key={i} className="font-semibold">{t.slice(1, -1)}</strong>;
          if (t.startsWith("_") && t.endsWith("_"))
            return <em key={i} className="italic opacity-80">{t.slice(1, -1)}</em>;
          return <span key={i}>{t}</span>;
        })}
        {li < lines.length - 1 && <br />}
      </span>
    );
  });
}

function trimMessageForMobile(text: string) {
  let t = text.replace(/`000201[^`]+`/g, "`PIX copia e cola`");
  const lines = t.split("\n").filter(Boolean);
  if (lines.length > 3) return `${lines.slice(0, 3).join("\n")}\n…`;
  if (t.length > 120) return `${t.slice(0, 117)}…`;
  return t;
}

function mobilePreviewMessages(messages: ChatMsg[]) {
  if (messages.length <= 2) return messages;
  const pixStep = messages.some((m) => /PIX|Cobrança/i.test(m.text));
  if (pixStep && messages.length > 2) return messages.slice(0, 2);
  return messages.slice(-2);
}

function WaChat({
  businessName,
  messages,
  className,
  compact = false,
}: {
  businessName: string;
  messages: ChatMsg[];
  className?: string;
  compact?: boolean;
}) {
  const visible = compact ? mobilePreviewMessages(messages) : messages;

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl border border-gray-200/80 shadow-lg ${className ?? ""}`}
    >
      <div
        className={`flex flex-shrink-0 items-center gap-2 bg-[#075E54] px-3 ${compact ? "py-2" : "px-4 py-3 gap-3"}`}
      >
        <div
          className={`flex shrink-0 items-center justify-center rounded-full bg-[#128C7E] font-bold text-white ${compact ? "h-8 w-8 text-xs" : "h-9 w-9 text-sm"}`}
        >
          {businessName.trim()[0]}
        </div>
        <div className="min-w-0">
          <p className={`truncate font-semibold leading-tight text-white ${compact ? "text-xs" : "text-sm"}`}>
            {businessName}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] leading-none text-[#A8D5CF]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#4FC3F7]" />
            online
          </p>
        </div>
      </div>

      <div
        className={`space-y-1.5 overflow-hidden px-2 py-2 ${compact ? "" : "min-h-0 flex-1 overflow-y-auto overscroll-contain sm:space-y-2 sm:px-3 sm:py-3"}`}
        style={{
          background: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23ece5dd'/%3E%3C/svg%3E\")",
          backgroundColor: "#ECE5DD",
        }}
      >
        {visible.map((msg, i) => {
          const isIa = msg.from === "ia";
          const body = compact ? trimMessageForMobile(msg.text) : msg.text;
          return (
            <div key={i} className={`flex ${isIa ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[92%] rounded-2xl px-2 py-1 shadow-sm leading-snug relative ${
                  compact ? "text-[10px]" : "px-2.5 py-1.5 text-[11px] sm:text-[12.5px] leading-relaxed"
                } ${
                  isIa
                    ? "bg-[#DCF8C6] text-gray-800 rounded-tr-sm"
                    : "bg-white text-gray-800 rounded-tl-sm"
                }`}
              >
                <div className={compact ? "line-clamp-4" : undefined}>{parseWaText(body)}</div>
                <div className="mt-0.5 flex items-center justify-end gap-1">
                  <span className="text-[9px] text-gray-400 sm:text-[10px]">{msg.time}</span>
                  {isIa && !compact && (
                    <svg viewBox="0 0 16 11" className="h-3 w-4 fill-[#53BDEB]">
                      <path d="M11.071.653a.75.75 0 0 0-1.142 0L5.857 5.726 4.07 3.939a.75.75 0 1 0-1.06 1.06L5.326 7.31a.75.75 0 0 0 1.06 0l4.685-4.957M15.07.653a.75.75 0 0 0-1.142 0L9.857 5.726l-.571-.571" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={`hidden flex-shrink-0 items-center gap-2 bg-[#F0F2F5] px-3 py-2 md:flex ${compact ? "!hidden" : ""}`}>
        <div className="flex-1 bg-white rounded-full px-4 py-2 text-xs text-gray-400">
          Mensagem
        </div>
        <div className="w-9 h-9 rounded-full bg-[#128C7E] flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function lsKey(uid: string) {
  return `flowdesk_onboarding_done_${uid}`;
}

type OnboardingTourProps = {
  variant?: "dashboard" | "public";
};

export function OnboardingTour({ variant = "dashboard" }: OnboardingTourProps) {
  const isPublic = variant === "public";
  const router = useAppRouter();
  const { uid, ready } = useAuth();
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [forceOpen, setForceOpen] = useState(false);
  const [hydrated, setHydrated] = useState(isPublic);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isPublic) {
      setHydrated(true);
      return;
    }
    if (!uid) return;
    setDismissed(localStorage.getItem(lsKey(uid)) === "1");
    setHydrated(true);
  }, [uid, isPublic]);

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["tenant", uid],
    queryFn: () => tenantApi.get(),
    enabled: !isPublic && ready && !!uid,
  });

  const complete = useMutation({
    mutationFn: () => tenantApi.completeOnboarding(),
  });

  function dismiss() {
    if (!isPublic && uid) localStorage.setItem(lsKey(uid), "1");
    setDismissed(true);
    setForceOpen(false);
    if (!isPublic) {
      complete.mutate(undefined, {
        onSettled: () => router.replace(CREATE_BUSINESS_PATH),
      });
      return;
    }
  }

  const current = STEPS[step];
  const done = Boolean((tenant as any)?.onboardingCompletedAt);
  const visible =
    hydrated &&
    !dismissed &&
    (isPublic ? forceOpen : !isLoading && !!tenant && (!done || forceOpen));
  const canBack = step > 0;
  const isLast = step === STEPS.length - 1;
  const progress = useMemo(() => ((step + 1) / STEPS.length) * 100, [step]);

  useEffect(() => {
    function openOnboarding() {
      setStep(0);
      setForceOpen(true);
      if (uid) localStorage.removeItem(lsKey(uid));
      setDismissed(false);
    }
    window.addEventListener("flowdesk:open-onboarding", openOnboarding);
    return () => window.removeEventListener("flowdesk:open-onboarding", openOnboarding);
  }, [uid]);

  if (!visible) return null;

  const stepDots = (
    <div className="flex items-center justify-center gap-2 md:justify-start">
      {STEPS.map((_, i) => (
        <Button
          key={i}
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => setStep(i)}
          aria-label={`Etapa ${i + 1}`}
          className={cn(
            "rounded-full p-0 transition-all duration-300",
            i === step ? "w-6 h-2 bg-brand-600 hover:bg-brand-600" : "w-2 h-2 bg-gray-200 hover:bg-gray-300"
          )}
        />
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 backdrop-blur-sm md:items-center md:p-4">
      <div className="flex h-[100dvh] max-h-[100dvh] w-full max-w-4xl flex-col overflow-hidden bg-white shadow-2xl md:h-auto md:max-h-[90vh] md:rounded-3xl md:border md:border-gray-100">

        <div className="h-1 flex-shrink-0 bg-gray-100">
          <div
            className="h-full bg-brand-600 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain md:overflow-hidden md:flex-row">

          <div className="flex flex-shrink-0 flex-col border-b border-gray-100 px-4 py-3 md:hidden">
            <div className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700 ring-1 ring-brand-200/60">
              <Zap className="h-3 w-3" />
              {current.badge}
            </div>
            <h2 className="text-lg font-bold leading-snug text-gray-900">{current.title}</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-gray-600">{current.subtitle}</p>
            <ul className="mt-3 space-y-2">
              {current.features.map(({ icon: FIcon, text }, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-700 px-3 py-2.5 shadow-md ring-1 ring-brand-800/15"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20">
                    <FIcon className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-[11px] font-semibold leading-snug text-white">
                    {text}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3">{stepDots}</div>
          </div>

          <div className="hidden w-[42%] flex-shrink-0 flex-col justify-between p-6 md:flex md:p-8">
            <div>
              <div className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                <Zap className="h-3 w-3" />
                {current.badge}
              </div>
              <h2 className="mb-3 text-2xl font-bold leading-snug text-gray-900">{current.title}</h2>
              <p className="mb-6 text-sm leading-relaxed text-gray-500">{current.subtitle}</p>
              <ul className="space-y-3">
                {current.features.map(({ icon: FIcon, text }, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50">
                      <FIcon className="h-3.5 w-3.5 text-brand-600" />
                    </div>
                    <span className="text-sm text-gray-700">{text}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-6">{stepDots}</div>
          </div>

          <div className="flex flex-shrink-0 flex-col justify-center bg-gradient-to-br from-brand-50 via-white to-emerald-50 px-3 py-2 md:min-h-0 md:flex-1 md:gap-3 md:border-l md:p-5">
            <div className={isMobile ? "" : "min-h-0 flex-1"}>
              <WaChat
                businessName={current.chat.businessName}
                messages={current.chat.messages}
                compact={isMobile}
                className={
                  isMobile
                    ? "mx-auto w-full max-w-sm"
                    : "h-full min-h-[280px] w-full"
                }
              />
            </div>
          </div>
        </div>

        <div className="relative z-10 flex flex-shrink-0 flex-col gap-2 border-t border-gray-100 bg-gray-50 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between md:px-8 md:py-4">
          <Button
            type="button"
            variant="link"
            onClick={dismiss}
            className="order-2 h-auto p-0 text-center text-sm text-gray-400 hover:text-gray-600 sm:order-1 sm:text-left"
            disabled={complete.isPending}
          >
            Pular tour
          </Button>

          <div className="order-1 flex items-center gap-2 sm:order-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() => setStep((s) => s - 1)}
              disabled={!canBack}
            >
              <ChevronLeft className="h-4 w-4 shrink-0" />
              Voltar
            </Button>
            <Button
              type="button"
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() => {
                if (isLast) {
                  dismiss();
                  return;
                }
                setStep((s) => s + 1);
              }}
              disabled={complete.isPending}
            >
              {isLast ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Começar
                </>
              ) : (
                <>
                  Próximo
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

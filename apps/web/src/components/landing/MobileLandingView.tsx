"use client";

import {
  ArrowRight,
  CalendarCheck,
  Check,
  MessageSquare,
  QrCode,
  ShoppingBag,
  Sparkles,
  Wallet,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import {
  APP_DISPLAY_NAME,
  PLAN_PRICES,
  STARTER_TRIAL_DAYS,
  planMarketingFeatures,
} from "@flowdesk/shared";
import type { PlanTier } from "@flowdesk/shared";

const WHATSAPP_URL =
  "https://wa.me/5531973616454?text=" +
  encodeURIComponent("Quero testar o FlowDesk grátis!");

const FEATURES = [
  {
    icon: MessageSquare,
    title: "Atendimento 24h com IA",
    desc: "Responde clientes sozinho, a qualquer hora.",
  },
  {
    icon: CalendarCheck,
    title: "Agendamento guiado",
    desc: "Cliente marca horário direto no WhatsApp.",
  },
  {
    icon: ShoppingBag,
    title: "Catálogo e orçamento",
    desc: "Produtos e preços apresentados no chat.",
  },
  {
    icon: Wallet,
    title: "Cobrança PIX automática",
    desc: "Recebe pagamento sem sair da conversa.",
  },
  {
    icon: QrCode,
    title: "Conexão fácil",
    desc: "Ligue seu número em segundos via QR Code.",
  },
];

const PLANS: { id: PlanTier; highlight?: boolean; badge?: string; extras?: string[] }[] = [
  { id: "STARTER" },
  { id: "PRO", highlight: true, badge: "Mais popular", extras: ["Cobrança PIX automática"] },
  { id: "UNLIMITED", extras: ["Suporte prioritário"] },
];

function PlanRow({ id, highlight, badge, extras = [] }: (typeof PLANS)[number]) {
  const price = PLAN_PRICES[id];
  const features = [...planMarketingFeatures(id), ...extras];

  return (
    <div
      className={cn(
        "rounded-2xl border p-5",
        highlight
          ? "border-brand-500 bg-brand-50 shadow-sm ring-1 ring-brand-200"
          : "border-slate-200 bg-white",
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">{price.label}</h3>
        {badge ? (
          <span className="rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-semibold text-white">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-extrabold text-slate-900">
          {formatCurrency(price.brl)}
        </span>
        <span className="text-sm text-slate-500">/mês</span>
      </p>
      <p className="mt-0.5 text-xs text-slate-500">
        {id === "STARTER" ? `${STARTER_TRIAL_DAYS} dias grátis · sem cartão` : "Cobrança imediata"}
      </p>
      <ul className="mt-4 space-y-2 text-sm text-slate-700">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MobileLandingView() {
  return (
    <div className="min-h-[100dvh] bg-[#f7f7f5] pb-28">
      <header className="flex items-center gap-2 px-5 pt-6">
        <span className="text-lg font-bold tracking-tight text-primary">
          {APP_DISPLAY_NAME}
        </span>
        <span className="flex size-8 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
          <MessageSquare className="size-4 text-primary" />
        </span>
      </header>

      <section className="px-5 pt-8">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-brand-800">
          <Sparkles className="size-3" aria-hidden />
          {STARTER_TRIAL_DAYS} dias grátis
        </span>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-slate-900">
          Seu atendimento no WhatsApp automático com IA
        </h1>
        <p className="mt-3 text-base text-slate-600">
          Responde clientes, agenda horários, envia confirmações e cobra via PIX — sozinho.
        </p>
      </section>

      <section className="mt-10 px-5">
        <h2 className="text-lg font-bold text-slate-900">O que o {APP_DISPLAY_NAME} faz</h2>
        <div className="mt-4 space-y-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-semibold text-slate-900">{title}</p>
                <p className="mt-0.5 text-sm text-slate-600">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 px-5">
        <h2 className="text-lg font-bold text-slate-900">Planos</h2>
        <p className="mt-1 text-sm text-slate-600">Sem taxa escondida. Cancele quando quiser.</p>
        <div className="mt-4 space-y-4">
          {PLANS.map((plan) => (
            <PlanRow key={plan.id} {...plan} />
          ))}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-5 py-3 backdrop-blur-md">
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants(),
            "h-12 w-full gap-2 rounded-full text-base font-semibold hover:bg-brand-700",
          )}
        >
          Testar grátis
          <ArrowRight className="size-5" aria-hidden />
        </a>
      </div>
    </div>
  );
}

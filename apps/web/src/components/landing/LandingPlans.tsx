"use client";

import { Check, Crown, Sparkles, Zap } from "lucide-react";
import { WobbleCard } from "@/components/ui/wobble-card";
import { Button } from "@/components/ui/button";
import { useAuthDrawer } from "@/contexts/auth-drawer-context";
import { cn, formatCurrency } from "@/lib/utils";
import { PLAN_PRICES, planMarketingFeatures, STARTER_TRIAL_DAYS } from "@flowdesk/shared";
import type { PlanTier } from "@flowdesk/shared";

type PlanCardConfig = {
  id: PlanTier;
  highlight?: boolean;
  extras?: string[];
  containerClassName: string;
  badge?: string;
};

const PLANS: PlanCardConfig[] = [
  {
    id: "STARTER",
    containerClassName: "bg-gradient-to-br from-slate-700 to-slate-900",
  },
  {
    id: "PRO",
    highlight: true,
    extras: ["Cobrança PIX automática", "Relatórios avançados"],
    containerClassName: "bg-gradient-to-br from-brand-600 to-brand-900",
    badge: "Mais popular",
  },
  {
    id: "UNLIMITED",
    extras: ["Suporte prioritário", "Tudo do Pro"],
    containerClassName: "bg-gradient-to-br from-violet-600 to-purple-900",
  },
];

function PlanWobbleCard({
  id,
  highlight,
  extras = [],
  containerClassName,
  badge,
  onSelect,
}: PlanCardConfig & { onSelect: () => void }) {
  const price = PLAN_PRICES[id];
  const features = [...planMarketingFeatures(id), ...extras];

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col",
        highlight && "lg:-mt-2 lg:mb-2",
      )}
    >
      <WobbleCard
        containerClassName={cn(
          "h-full min-h-[16rem] sm:min-h-[17rem]",
          containerClassName,
          highlight &&
            "ring-2 ring-brand-300/80 ring-offset-2 ring-offset-transparent",
        )}
        className="flex h-full flex-col px-4 py-4 sm:px-5 sm:py-5"
      >
        <div className="relative z-10 flex h-full flex-col text-white">
          {badge ? (
            <span className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-sm">
              <Crown className="size-3" aria-hidden />
              {badge}
            </span>
          ) : (
            <span className="mb-2 h-[19px]" aria-hidden />
          )}

          <h3 className="text-base font-bold tracking-tight sm:text-lg">
            {price.label}
          </h3>
          <p className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-extrabold tracking-tight sm:text-[1.75rem]">
              {formatCurrency(price.brl)}
            </span>
            <span className="text-xs font-medium text-white/70">/mês</span>
          </p>
          <p className="mt-0.5 text-xs text-white/65">
            {id === "STARTER" ? `${STARTER_TRIAL_DAYS} dias grátis · sem cartão` : "Cobrança imediata"}
          </p>

          <ul className="mt-2.5 flex-1 space-y-1 text-xs text-white/90 sm:text-sm">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-1.5">
                <Check
                  className="mt-0.5 size-3.5 shrink-0 text-white"
                  aria-hidden
                />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect();
            }}
            className={cn(
              "relative z-10 mt-3 h-9 w-full rounded-full text-sm font-semibold",
              highlight
                ? "bg-white text-brand-800 hover:bg-white/90"
                : "bg-white/15 text-white backdrop-blur-sm hover:bg-white/25",
            )}
          >
            {id === "STARTER" ? "Começar grátis" : "Assinar agora"}
          </Button>
        </div>
      </WobbleCard>
    </div>
  );
}

export function LandingPlans({ adMode = false }: { adMode?: boolean }) {
  const { openAuth } = useAuthDrawer();

  return (
    <section
      id="precos"
      data-snap-section
      aria-labelledby="plans-heading"
      className="relative flex h-dvh snap-start snap-always flex-col justify-center overflow-x-hidden border-t border-slate-200/80 bg-gradient-to-b from-slate-100/90 via-[#f3f0fa] to-white px-4 py-4 sm:px-6 sm:py-6 lg:px-10"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_0%,rgba(124,58,237,0.1),transparent)]"
        aria-hidden
      />
      <div className="relative mx-auto w-full max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm backdrop-blur-sm ${
              adMode
                ? "border-brand-300 bg-brand-50 text-brand-800 ring-2 ring-brand-200/60"
                : "border-brand-200/80 bg-white/80 text-brand-800"
            }`}
          >
            <Zap className="size-3" aria-hidden />
            {adMode
              ? `Teste grátis ${STARTER_TRIAL_DAYS} dias — sem cartão`
              : `Starter: ${STARTER_TRIAL_DAYS} dias grátis`}
          </span>
          <h2
            id="plans-heading"
            className="mt-2.5 text-xl font-bold tracking-tight text-foreground sm:text-2xl lg:text-3xl"
          >
            {adMode ? "Escolha seu plano e comece agora" : "Planos simples para crescer no WhatsApp"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            {adMode
              ? "Ative o trial em um clique. Upgrade só quando fizer sentido para o seu negócio."
              : "Sem taxa escondida. Escale quando precisar — do trial ao plano completo."}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-3 items-stretch gap-3 sm:mt-6 sm:gap-4 lg:gap-6">
          {PLANS.map((plan) => (
            <PlanWobbleCard
              key={plan.id}
              {...plan}
              onSelect={() => openAuth("register")}
            />
          ))}
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-sm text-muted-foreground sm:mt-6">
          <Sparkles className="size-4 text-brand-600" aria-hidden />
          Cancele quando quiser
        </p>
      </div>
    </section>
  );
}

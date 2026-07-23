import { Clock } from "lucide-react";
import { IaIcon } from "@/lib/ia-brand";
import { HeroAreaChart, HeroBarChart } from "@/components/landing/HeroCharts";
import { HeroGlassCard } from "@/components/landing/HeroGlassCard";
import { WhatsAppInset } from "@/components/landing/WhatsAppInset";

const TEXT_SHADOW = "[text-shadow:0_1px_6px_rgba(0,0,0,0.55)]";

export function HeroStatsCard() {
  return (
    <HeroGlassCard className="w-[152px] sm:w-[180px]">
      <HeroAreaChart />
      <p
        className={`mt-1.5 text-xl font-semibold tracking-tight text-white sm:text-2xl ${TEXT_SHADOW}`}
      >
        847
      </p>
      <p className={`text-[11px] font-medium leading-tight text-white/90 sm:text-xs ${TEXT_SHADOW}`}>
        Mensagens respondidas (7d)
      </p>
    </HeroGlassCard>
  );
}

export function HeroOnlineBadge() {
  return (
    <div className="hero-glass flex w-fit items-center gap-2.5 px-3 py-2">
      <span className="flex size-7 items-center justify-center rounded-full bg-white/25">
        <IaIcon className="size-3.5 text-white" />
      </span>
      <div className="leading-none">
        <p className={`text-sm font-semibold text-white ${TEXT_SHADOW}`}>24h</p>
        <p className={`text-[11px] font-medium text-white/85 ${TEXT_SHADOW}`}>Online</p>
      </div>
    </div>
  );
}

export function HeroResponseCard() {
  return (
    <HeroGlassCard className="w-[168px] sm:w-[190px]">
      <div className="mb-1.5 flex items-end justify-between gap-2">
        <HeroBarChart />
        <Clock className="size-4 shrink-0 text-white/90" />
      </div>
      <p className={`text-lg font-semibold tracking-tight text-white ${TEXT_SHADOW}`}>
        &lt; 30s
      </p>
      <p className={`text-[11px] font-medium text-white/90 sm:text-xs ${TEXT_SHADOW}`}>
        Tempo médio de resposta
      </p>
    </HeroGlassCard>
  );
}

export function HeroWhatsAppInset() {
  return <WhatsAppInset className="w-[152px] sm:w-[180px]" />;
}

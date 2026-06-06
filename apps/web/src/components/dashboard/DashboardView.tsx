"use client";

import { useState, useEffect } from "react";
import type { Business } from "@flowdesk/firebase/client";
import { formatCurrency, cn } from "@/lib/utils";
import {
  MessageSquare, Calendar, DollarSign, TrendingUp,
} from "lucide-react";
import { getBusinessVocabulary } from "@flowdesk/shared";
import type { DashboardAnalytics } from "@/lib/server/data/dashboard";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";

function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) {
      setVal(0);
      return;
    }
    let s: number | null = null;
    const tick = (ts: number) => {
      if (!s) s = ts;
      const p = Math.min((ts - s) / duration, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 4)) * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return val;
}

function KpiCard({
  label,
  rawValue,
  displayValue,
  icon: Icon,
  iconColor,
  iconBg,
}: {
  label: string;
  rawValue: number;
  displayValue?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
}) {
  const counted = useCountUp(rawValue);
  const shown = displayValue ?? counted.toLocaleString("pt-BR");

  return (
    <div className="flex min-h-[88px] items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
      <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", iconBg)}>
        <Icon className={cn("size-5", iconColor)} />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-semibold tabular-nums tracking-tight text-gray-900">{shown}</p>
        <p className="mt-0.5 text-xs leading-snug text-gray-500">{label}</p>
      </div>
    </div>
  );
}

type DashboardViewProps = {
  business: Business;
  analytics: DashboardAnalytics | null;
};

export function DashboardView({ business, analytics }: DashboardViewProps) {
  const v = getBusinessVocabulary(business.type);

  const conv = analytics?.conversations.thisMonth ?? 0;
  const pend = analytics?.appointments.pending ?? 0;
  const rev = analytics?.payments.revenueThisMonth ?? 0;
  const growth = analytics?.conversations.growth ?? 0;

  const now = new Date();

  const growthLabel = analytics
    ? `${growth > 0 ? "+" : growth < 0 ? "−" : ""}${Math.abs(growth)}%`
    : "—";

  return (
    <div className="flex flex-col gap-4">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Conversas este mês"
          rawValue={conv}
          icon={MessageSquare}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <KpiCard
          label={v.bookingsPlural}
          rawValue={pend}
          icon={Calendar}
          iconColor="text-violet-600"
          iconBg="bg-violet-50"
        />
        <KpiCard
          label="Receita este mês"
          rawValue={rev}
          displayValue={analytics ? formatCurrency(rev) : "—"}
          icon={DollarSign}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <KpiCard
          label="Crescimento mensal"
          rawValue={Math.abs(growth)}
          displayValue={growthLabel}
          icon={TrendingUp}
          iconColor={growth >= 0 ? "text-orange-600" : "text-red-600"}
          iconBg={growth >= 0 ? "bg-orange-50" : "bg-red-50"}
        />
      </section>

      <DashboardCharts
        weekByDay={analytics?.conversations.thisWeekByDay}
        monthByDay={analytics?.conversations.thisMonthByDay}
        refDate={now}
      />
    </div>
  );
}

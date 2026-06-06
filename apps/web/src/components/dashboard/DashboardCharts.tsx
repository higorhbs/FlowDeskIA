"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { conversationsTotal, monthTitle, weekConversationsData, monthConversationsData } from "@/components/dashboard/chart-data";

const ChartSkeleton = () => <Skeleton className="h-[240px] w-full rounded-lg" />;

const WeekConversationsChart = dynamic(
  () =>
    import("@/components/dashboard/WeekConversationsChart").then((m) => ({
      default: m.WeekConversationsChart,
    })),
  { loading: ChartSkeleton }
);

const MonthConversationsChart = dynamic(
  () =>
    import("@/components/dashboard/MonthConversationsChart").then((m) => ({
      default: m.MonthConversationsChart,
    })),
  { loading: ChartSkeleton }
);

type DashboardChartsProps = {
  weekByDay: number[] | undefined;
  monthByDay: number[] | undefined;
  refDate: Date;
};

export function DashboardCharts({ weekByDay, monthByDay, refDate }: DashboardChartsProps) {
  const weekData = weekConversationsData(weekByDay);
  const weekTotal = conversationsTotal(weekData);
  const monthData = monthConversationsData(monthByDay, refDate);
  const monthTotal = conversationsTotal(monthData);

  return (
    <section className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="min-w-0 ring-gray-200">
        <CardHeader>
          <CardTitle>Conversas esta semana</CardTitle>
          <CardDescription>Domingo a sábado · {weekTotal} conversas</CardDescription>
          {weekTotal > 0 && (
            <CardAction>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-sm bg-[hsl(var(--chart-1))]" />
                  Hoje
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-sm bg-[color-mix(in_oklab,hsl(var(--chart-1))_35%,transparent)]" />
                  Outros dias
                </span>
              </div>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="min-w-0">
          <WeekConversationsChart byDay={weekByDay} />
        </CardContent>
      </Card>

      <Card className="min-w-0 ring-gray-200">
        <CardHeader>
          <CardTitle>Mês atual</CardTitle>
          <CardDescription className="capitalize">
            {monthTitle(refDate)} · {monthTotal} conversas
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0">
          <MonthConversationsChart byDay={monthByDay} refDate={refDate} />
        </CardContent>
      </Card>
    </section>
  );
}

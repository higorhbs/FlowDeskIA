"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ConversationsChartEmpty } from "@/components/dashboard/ConversationsChartEmpty";
import { conversationsTotal, weekConversationsData } from "@/components/dashboard/chart-data";
import { chartMotion, useRevealedChartData } from "@/components/dashboard/use-chart-animate";
import { ConversationsYAxis } from "@/components/dashboard/ConversationsYAxis";

const chartConfig = {
  conversas: {
    label: "Conversas",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

type WeekConversationsChartProps = {
  byDay: number[] | undefined;
};

export function WeekConversationsChart({ byDay }: WeekConversationsChartProps) {
  const data = weekConversationsData(byDay);
  const displayData = useRevealedChartData(data);
  const total = conversationsTotal(data);
  const todayIdx = new Date().getDay();
  const peak = Math.max(...data.map((d) => d.conversas), 1);

  if (total <= 0) {
    return <ConversationsChartEmpty label="Nenhuma conversa esta semana" />;
  }

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full min-w-0">
      <BarChart accessibilityLayer data={displayData} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <ConversationsYAxis peak={peak} />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          minTickGap={0}
        />
        <ChartTooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.35, radius: 8 }}
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const day = payload?.[0]?.payload?.day as string | undefined;
                return day ?? "";
              }}
              formatter={(value) => {
                const count = Number(value);
                return [`${count} conversa${count === 1 ? "" : "s"}`, ""];
              }}
            />
          }
        />
        <Bar
          dataKey="conversas"
          radius={[8, 8, 0, 0]}
          maxBarSize={42}
          isAnimationActive
          animationBegin={chartMotion.begin}
          animationDuration={chartMotion.duration}
          animationEasing={chartMotion.easing}
        >
          {displayData.map((_, i) => (
            <Cell
              key={i}
              fill={
                i === todayIdx
                  ? "var(--color-conversas)"
                  : "color-mix(in oklab, var(--color-conversas) 28%, transparent)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

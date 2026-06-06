"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ConversationsChartEmpty } from "@/components/dashboard/ConversationsChartEmpty";
import { conversationsTotal, monthConversationsData } from "@/components/dashboard/chart-data";
import { chartMotion, useRevealedChartData } from "@/components/dashboard/use-chart-animate";
import { monthChartStyle } from "@/components/dashboard/month-chart-style";
import { ConversationsYAxis } from "@/components/dashboard/ConversationsYAxis";

const chartConfig = {
  conversas: {
    label: "Conversas",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

type MonthConversationsChartProps = {
  byDay: number[] | undefined;
  refDate?: Date;
};

export function MonthConversationsChart({ byDay, refDate = new Date() }: MonthConversationsChartProps) {
  const fillId = useId().replace(/:/g, "");
  const data = monthConversationsData(byDay, refDate);
  const displayData = useRevealedChartData(data);
  const total = conversationsTotal(data);
  const peak = Math.max(...data.map((d) => d.conversas), 1);
  const style = monthChartStyle;

  if (total <= 0) {
    return <ConversationsChartEmpty label="Nenhuma conversa este mês" />;
  }

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full min-w-0">
      <AreaChart accessibilityLayer data={displayData} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={style.stroke} stopOpacity={style.fillGradient.topOpacity} />
            <stop offset="100%" stopColor={style.stroke} stopOpacity={style.fillGradient.bottomOpacity} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <ConversationsYAxis peak={peak} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
          minTickGap={24}
          interval="preserveStartEnd"
          tickFormatter={(value, index) => {
            const show =
              index === 0 || index === data.length - 1 || (index + 1) % 5 === 0;
            return show ? String(value) : "";
          }}
        />
        <ChartTooltip
          cursor={style.tooltipCursor}
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const date = payload?.[0]?.payload?.date as string | undefined;
                return date ?? "";
              }}
              formatter={(value) => {
                const count = Number(value);
                return [`${count} conversa${count === 1 ? "" : "s"}`, ""];
              }}
            />
          }
        />
        <Area
          type={style.curve}
          dataKey="conversas"
          stroke={style.stroke}
          strokeWidth={style.strokeWidth}
          strokeLinecap={style.strokeLinecap}
          strokeLinejoin={style.strokeLinejoin}
          fill={`url(#${fillId})`}
          dot={style.dot}
          activeDot={{
            r: style.activeDot.r,
            fill: style.stroke,
            stroke: style.activeDot.stroke,
            strokeWidth: style.activeDot.strokeWidth,
          }}
          isAnimationActive
          animationBegin={chartMotion.begin}
          animationDuration={chartMotion.duration}
          animationEasing={chartMotion.easing}
        />
      </AreaChart>
    </ChartContainer>
  );
}

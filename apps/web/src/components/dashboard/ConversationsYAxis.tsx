import { YAxis } from "recharts";

export function conversationsYMax(peak: number) {
  return Math.max(Math.ceil(peak * 1.15), 1);
}

type ConversationsYAxisProps = {
  peak: number;
};

export function ConversationsYAxis({ peak }: ConversationsYAxisProps) {
  return (
    <YAxis
      width={36}
      domain={[0, conversationsYMax(peak)]}
      tickLine={false}
      axisLine={false}
      tickMargin={8}
      allowDecimals={false}
      tickCount={5}
    />
  );
}

import { BarChart3 } from "lucide-react";

type ConversationsChartEmptyProps = {
  label: string;
};

export function ConversationsChartEmpty({ label }: ConversationsChartEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-muted">
        <BarChart3 className="text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        Os dados aparecem quando houver conversas no WhatsApp.
      </p>
    </div>
  );
}

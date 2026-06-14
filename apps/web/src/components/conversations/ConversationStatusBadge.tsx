import { Bot, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, cn } from "@/lib/utils";

const STATUS_ICONS = {
  OPEN: Bot,
  ATTENDING: User,
} as const;

type ConversationStatusBadgeProps = {
  status: string;
  className?: string;
};

export function ConversationStatusBadge({ status, className }: ConversationStatusBadgeProps) {
  const meta = STATUS_LABELS[status];
  if (!meta) return null;
  const Icon = STATUS_ICONS[status as keyof typeof STATUS_ICONS];
  return (
    <Badge variant="secondary" className={cn(meta.color, className)}>
      {Icon ? <Icon /> : null}
      {meta.label}
    </Badge>
  );
}

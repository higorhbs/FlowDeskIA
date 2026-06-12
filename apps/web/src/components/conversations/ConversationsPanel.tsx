import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ConversationsPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

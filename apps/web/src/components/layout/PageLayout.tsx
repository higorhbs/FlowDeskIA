import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageLayoutProps = {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function PageLayout({
  title,
  description,
  action,
  children,
  className,
}: PageLayoutProps) {
  return (
    <div className={cn("p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900">
            {title}
          </h1>
          {description ? (
            <div className="text-sm text-gray-500 leading-relaxed max-w-2xl">
              {description}
            </div>
          ) : null}
        </div>
        {action ? (
          <div className="flex shrink-0 items-center gap-2 w-full sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">
            {action}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

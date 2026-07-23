"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type IaTab = "mensagens" | "menu" | "faqs" | "leadflow" | "resume" | "weeklymenu" | "orderbot";

export type IaSectionTab = {
  id: IaTab;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
};

export function IaSectionNav({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: readonly IaSectionTab[];
  activeTab: IaTab;
  onChange: (id: IaTab) => void;
}) {
  return (
    <>
      <nav className="hidden md:flex md:flex-col gap-1.5">
        {tabs.map(({ id, label, description, icon: Icon, active }) => {
          const isActive = activeTab === id;
          return (
            <Button
              key={id}
              type="button"
              variant="ghost"
              onClick={() => onChange(id)}
              className={cn(
                "h-auto w-full items-start justify-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all",
                isActive
                  ? "border-brand-200 bg-brand-50 shadow-sm"
                  : "border-transparent hover:border-gray-200 hover:bg-gray-50",
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl",
                  isActive ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-500",
                )}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1 whitespace-normal">
                <div className="flex items-center gap-1.5">
                  <p
                    className={cn(
                      "text-sm font-semibold truncate",
                      isActive ? "text-brand-900" : "text-gray-800",
                    )}
                  >
                    {label}
                  </p>
                  {active !== undefined && (
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full flex-shrink-0",
                        active ? "bg-emerald-500" : "bg-gray-300",
                      )}
                      title={active ? "Ativado" : "Desativado"}
                    />
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5 leading-snug whitespace-normal break-words">
                  {description}
                </p>
              </div>
              {isActive && <ChevronRight className="w-4 h-4 text-brand-400 mt-2 flex-shrink-0" />}
            </Button>
          );
        })}
      </nav>

      <div className="flex md:hidden gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <Button
              key={id}
              type="button"
              variant="ghost"
              onClick={() => onChange(id)}
              className={cn(
                "h-auto flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200",
              )}
            >
              <Icon className={cn("w-4 h-4", isActive ? "text-white" : "text-gray-400")} />
              {label}
            </Button>
          );
        })}
      </div>
    </>
  );
}

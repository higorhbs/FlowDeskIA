"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthDrawer } from "@/contexts/auth-drawer-context";

type HeroCtaProps = {
  className?: string;
};

export function HeroCta({ className }: HeroCtaProps) {
  const { openAuth } = useAuthDrawer();

  return (
    <div className={cn("relative", className)}>
      <div
        className="absolute -inset-1 rounded-full bg-primary/40 blur-lg animate-pulse"
        aria-hidden
      />
      <Button
        type="button"
        onClick={() => openAuth("register")}
        className={cn(
          "group relative max-w-full overflow-hidden rounded-full border-0",
          "h-auto bg-gradient-to-r from-primary via-primary to-brand-700",
          "px-5 py-2.5 text-primary-foreground sm:px-6 sm:py-3",
          "ring-2 ring-primary/30 ring-offset-2 ring-offset-transparent",
          "transition-all duration-300",
          "hover:scale-[1.03] hover:bg-gradient-to-r hover:from-brand-500 hover:via-brand-500 hover:to-brand-600",
          "active:scale-[0.98] active:translate-y-0",
        )}
      >
        <span
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full"
          aria-hidden
        />
        <span className="relative flex items-center gap-1.5 truncate text-sm font-bold sm:text-base">
          <Sparkles className="size-3.5 shrink-0 text-primary-foreground/90 sm:size-4 animate-pulse" />
          Começar teste grátis
        </span>
      </Button>
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import { AppLink as Link } from "@/components/AppLink";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAppRouter } from "@/lib/app-navigation";
import { panelHref } from "@/lib/business-nav";
import { cn } from "@/lib/utils";

export function DashboardActions({ businessId }: { businessId: string }) {
  const router = useAppRouter();
  const [isPending, startTransition] = useTransition();

  function refresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="flex w-full items-center gap-2 sm:w-auto">
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        className="shrink-0 rounded-xl"
        onClick={refresh}
        disabled={isPending}
        aria-label="Atualizar dados"
      >
        <RefreshCw className={cn(isPending && "animate-spin")} />
      </Button>
      <Link
        href={panelHref(businessId, "conversations")}
        className={cn(buttonVariants({ size: "lg" }), "w-full rounded-xl sm:w-auto")}
      >
        Abrir conversas
        <ArrowRight />
      </Link>
    </div>
  );
}

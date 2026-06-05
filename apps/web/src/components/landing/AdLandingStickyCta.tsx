"use client";

import { Sparkles } from "lucide-react";
import { STARTER_TRIAL_DAYS } from "@flowdesk/shared";
import { Button } from "@/components/ui/button";
import { useAuthDrawer } from "@/contexts/auth-drawer-context";

export function AdLandingStickyCta() {
  const { openAuth } = useAuthDrawer();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <div className="pointer-events-auto mx-auto max-w-lg">
        <Button
          type="button"
          onClick={() => openAuth("register")}
          className="h-12 w-full rounded-full border-0 bg-gradient-to-r from-brand-600 to-brand-700 text-base font-bold shadow-lg shadow-brand-600/30"
        >
          <Sparkles className="mr-2 size-4" />
          Começar teste grátis — {STARTER_TRIAL_DAYS} dias
        </Button>
        <p className="mt-1.5 text-center text-[10px] font-medium text-gray-500">
          Sem cartão · Cancele quando quiser
        </p>
      </div>
    </div>
  );
}

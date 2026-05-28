"use client";

import { BusinessHeader } from "./BusinessHeader";
import { BusinessPageTransition } from "./BusinessPageTransition";
import { BusinessRouteSync } from "./BusinessRouteSync";
import { useBusinessId } from "@/lib/use-business-id";
import { useSyncWhatsAppBusiness } from "@/lib/use-sync-wa-business";

export function BusinessShell({ children }: { children: React.ReactNode }) {
  const id = useBusinessId();
  useSyncWhatsAppBusiness(id);

  return (
    <div className="flex flex-col min-h-full">
      <BusinessRouteSync />
      <BusinessHeader businessId={id} />
      <BusinessPageTransition>{children}</BusinessPageTransition>
    </div>
  );
}

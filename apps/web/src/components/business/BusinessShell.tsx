"use client";

import { BusinessHeader } from "./BusinessHeader";
import { BusinessPageTransition } from "./BusinessPageTransition";
import { BusinessRouteSync } from "./BusinessRouteSync";
import { useBusinessId } from "@/lib/use-business-id";
import { useSyncWhatsAppBusiness } from "@/lib/use-sync-wa-business";
import { BusinessPanelLoader } from "./BusinessPanelLoader";

export function BusinessShell({ children }: { children: React.ReactNode }) {
  const id = useBusinessId({ required: false });
  useSyncWhatsAppBusiness(id || "");

  if (!id) {
    return (
      <div className="flex flex-col min-h-full">
        <BusinessRouteSync />
        <BusinessPanelLoader />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      <BusinessRouteSync />
      <BusinessHeader businessId={id} />
      <BusinessPageTransition>{children}</BusinessPageTransition>
    </div>
  );
}

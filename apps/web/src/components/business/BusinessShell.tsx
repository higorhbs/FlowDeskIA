"use client";

import { BusinessHeader } from "./BusinessHeader";
import { useBusinessId } from "@/lib/use-business-id";
import { useSyncWhatsAppBusiness } from "@/lib/use-sync-wa-business";

export function BusinessShell({ children }: { children: React.ReactNode }) {
  const id = useBusinessId();
  useSyncWhatsAppBusiness(id);

  return (
    <div className="flex flex-col min-h-full">
      <BusinessHeader businessId={id} />
      {children}
    </div>
  );
}

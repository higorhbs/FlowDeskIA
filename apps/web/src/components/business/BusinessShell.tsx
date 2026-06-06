"use client";

import { BusinessPageTransition } from "./BusinessPageTransition";
import { BusinessRouteSync } from "./BusinessRouteSync";
import { useBusinessId } from "@/lib/use-business-id";
import { BusinessPanelLoader } from "./BusinessPanelLoader";

export function BusinessShell({ children }: { children: React.ReactNode }) {
  const id = useBusinessId({ required: false });

  if (!id) {
    return (
      <div className="flex flex-col h-full">
        <BusinessRouteSync />
        <BusinessPanelLoader />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <BusinessRouteSync />
      <BusinessPageTransition>{children}</BusinessPageTransition>
    </div>
  );
}

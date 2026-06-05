"use client";

import { BusinessPageTransition } from "./BusinessPageTransition";
import { BusinessRouteSync } from "./BusinessRouteSync";
import { BusinessPanelHost } from "./BusinessPanelHost";
import { useBusinessId } from "@/lib/use-business-id";
import { BusinessPanelLoader } from "./BusinessPanelLoader";

export function BusinessShell({
  children,
  usePanelHost = false,
}: {
  children: React.ReactNode;
  usePanelHost?: boolean;
}) {
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
      {usePanelHost
        ? <div className="flex-1 min-h-0 flex flex-col overflow-y-auto"><BusinessPanelHost /></div>
        : <BusinessPageTransition>{children}</BusinessPageTransition>
      }
    </div>
  );
}

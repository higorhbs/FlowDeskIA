"use client";

import { BusinessPageTransition } from "./BusinessPageTransition";
import { BusinessRouteSync } from "./BusinessRouteSync";
import { useBusinessId } from "@/lib/use-business-id";
import { BusinessPanelLoader } from "./BusinessPanelLoader";
import { pathBusinessSegment, HOSTING_PLACEHOLDER_BUSINESS_ID } from "@/lib/business-route";
import { usePathname } from "next/navigation";

export function BusinessShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const id = useBusinessId({ required: false });
  const segment = pathBusinessSegment(pathname);
  const stableId =
    id ||
    (segment && segment !== HOSTING_PLACEHOLDER_BUSINESS_ID ? segment : "");

  if (!stableId) {
    return (
      <div className="flex flex-col h-full">
        <BusinessRouteSync />
        <BusinessPanelLoader />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <BusinessRouteSync />
      <BusinessPageTransition>{children}</BusinessPageTransition>
    </div>
  );
}

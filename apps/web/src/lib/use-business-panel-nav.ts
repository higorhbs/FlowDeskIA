"use client";

import { hardNavigateHosting } from "@/lib/hosting-href";

export const BUSINESS_PANEL_NAV_EVENT = "business-panel-nav";

export function navigateBusinessPanel(href: string): void {
  hardNavigateHosting(href);
}

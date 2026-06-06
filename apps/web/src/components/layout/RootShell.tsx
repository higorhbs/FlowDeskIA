"use client";

import { MobileExperienceGate } from "@/components/layout/MobileExperienceGate";
import { ToasterHost } from "@/components/toaster-host";
import { CookieConsentBanner } from "@/components/privacy/CookieConsentBanner";

export function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <MobileExperienceGate>
      {children}
      <ToasterHost />
      <CookieConsentBanner />
    </MobileExperienceGate>
  );
}

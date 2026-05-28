"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { TrialGate } from "@/components/trial/TrialGate";
import { LgpdConsentGate } from "@/components/privacy/LgpdConsentGate";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-auto pb-20 lg:pb-0">{children}</main>
        <MobileNav />
        <OnboardingTour />
        <LgpdConsentGate />
        <TrialGate />
      </div>
    </RequireAuth>
  );
}

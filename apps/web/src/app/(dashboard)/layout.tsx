"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { TrialGate } from "@/components/trial/TrialGate";
import { LgpdConsentGate } from "@/components/privacy/LgpdConsentGate";
import { RequireBusinessGate } from "@/components/business/RequireBusinessGate";
import { BusinessVocabularyProvider } from "@/contexts/business-vocabulary-context";
import { DashboardChrome } from "@/components/layout/DashboardChrome";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <BusinessVocabularyProvider>
        <RequireBusinessGate>
          <DashboardChrome>{children}</DashboardChrome>
        </RequireBusinessGate>
        <OnboardingTour />
        <LgpdConsentGate />
        <TrialGate />
      </BusinessVocabularyProvider>
    </RequireAuth>
  );
}

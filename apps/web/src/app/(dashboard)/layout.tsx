import { RequireAuth } from "@/components/auth/RequireAuth";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { TrialGate } from "@/components/trial/TrialGate";
import { LgpdConsentGate } from "@/components/privacy/LgpdConsentGate";
import { RequireBusinessGate } from "@/components/business/RequireBusinessGate";
import { BusinessVocabularyProvider } from "@/contexts/business-vocabulary-context";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <BusinessVocabularyProvider>
        <RequireBusinessGate>{children}</RequireBusinessGate>
        <OnboardingTour />
        <LgpdConsentGate />
        <TrialGate />
      </BusinessVocabularyProvider>
    </RequireAuth>
  );
}

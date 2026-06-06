"use client";

import dynamic from "next/dynamic";

const OnboardingTour = dynamic(
  () => import("@/components/onboarding/OnboardingTour").then((m) => ({ default: m.OnboardingTour })),
  { ssr: false }
);
const TrialGate = dynamic(
  () => import("@/components/trial/TrialGate").then((m) => ({ default: m.TrialGate })),
  { ssr: false }
);
const LgpdConsentGate = dynamic(
  () => import("@/components/privacy/LgpdConsentGate").then((m) => ({ default: m.LgpdConsentGate })),
  { ssr: false }
);

export function DashboardDeferredGates() {
  return (
    <>
      <OnboardingTour />
      <LgpdConsentGate />
      <TrialGate />
    </>
  );
}

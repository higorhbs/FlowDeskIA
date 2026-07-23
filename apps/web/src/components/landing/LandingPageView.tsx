"use client";

import { useAdLanding } from "@/hooks/use-ad-landing";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { EmailVerificationBanner } from "@/components/auth/EmailVerificationBanner";
import { AdLandingStickyCta } from "@/components/landing/AdLandingStickyCta";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingPageBackground } from "@/components/landing/LandingPageBackground";
import { LandingPlans } from "@/components/landing/LandingPlans";
import { LandingSocialProof } from "@/components/landing/LandingSocialProof";
import { MobileLandingView } from "@/components/landing/MobileLandingView";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";

type LandingPageViewProps = {
  adMode?: boolean;
};

export function LandingPageView({ adMode: adModeProp }: LandingPageViewProps) {
  const fromAdClick = useAdLanding();
  const adMode = adModeProp ?? fromAdClick;
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileLandingView />;
  }

  return (
    <div className={`relative min-h-screen bg-[#f7f7f5] ${adMode ? "pb-24 md:pb-0" : ""}`}>
      <LandingPageBackground />
      <div className="relative z-10">
        <EmailVerificationBanner />
        <LandingHeader adMode={adMode} />
        <LandingHero adMode={adMode} />
        <LandingFeatures adMode={adMode} />
        <LandingSocialProof adMode={adMode} />
        <LandingPlans adMode={adMode} />
      </div>
      {adMode ? <AdLandingStickyCta /> : <OnboardingTour variant="public" />}
    </div>
  );
}

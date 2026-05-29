import { RedirectIfAuthenticated } from "@/components/auth/RedirectIfAuthenticated";
import { EmailVerificationBanner } from "@/components/auth/EmailVerificationBanner";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingPageBackground } from "@/components/landing/LandingPageBackground";
import { LandingPlans } from "@/components/landing/LandingPlans";
import { LandingSocialProof } from "@/components/landing/LandingSocialProof";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";

export default function HomePage() {
  return (
    <RedirectIfAuthenticated>
      <div className="relative min-h-screen bg-[#f7f7f5]">
        <LandingPageBackground />
        <div className="relative z-10">
          <EmailVerificationBanner />
          <LandingHeader />
          <LandingHero />
          <LandingSocialProof />
          <LandingPlans />
        </div>
        <OnboardingTour variant="public" />
      </div>
    </RedirectIfAuthenticated>
  );
}

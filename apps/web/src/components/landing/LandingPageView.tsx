"use client";

import { useEffect } from "react";
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

function useSnapScroll(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const html = document.documentElement;
    html.classList.add("snap-y", "snap-mandatory");
    return () => {
      html.classList.remove("snap-y", "snap-mandatory");
    };
  }, [enabled]);
}

// Native CSS scroll-snap alone only reliably advances a full screen when the
// wheel/trackpad gesture carries enough momentum to pass the halfway point —
// a single plain mouse-wheel tick doesn't. This makes every wheel gesture
// deterministically move exactly one screen, regardless of input device.
function useSectionWheelLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-snap-section]"),
    );
    if (sections.length < 2) return;

    let locked = false;
    let currentIndex = 0;

    const closestIndex = () => {
      const y = window.scrollY;
      let closest = 0;
      let closestDist = Infinity;
      sections.forEach((el, i) => {
        const dist = Math.abs(el.offsetTop - y);
        if (dist < closestDist) {
          closestDist = dist;
          closest = i;
        }
      });
      return closest;
    };

    currentIndex = closestIndex();

    const goTo = (index: number) => {
      const clamped = Math.max(0, Math.min(sections.length - 1, index));
      if (clamped === currentIndex) return;
      currentIndex = clamped;
      locked = true;
      sections[clamped].scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => {
        locked = false;
        currentIndex = closestIndex();
      }, 700);
    };

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 4) return;
      event.preventDefault();
      if (locked) return;
      // Recompute from actual scroll position — a nav-link click or browser
      // back/forward could have moved the page without going through goTo().
      currentIndex = closestIndex();
      goTo(currentIndex + (event.deltaY > 0 ? 1 : -1));
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [enabled]);
}

export function LandingPageView({ adMode: adModeProp }: LandingPageViewProps) {
  const fromAdClick = useAdLanding();
  const adMode = adModeProp ?? fromAdClick;
  const isMobile = useIsMobile();
  useSnapScroll(!isMobile);
  useSectionWheelLock(!isMobile);

  if (isMobile) {
    return <MobileLandingView />;
  }

  return (
    <div className={`relative min-h-screen bg-[#f7f7f5] ${adMode ? "pb-24 md:pb-0" : ""}`}>
      <LandingPageBackground />
      <div className="relative z-10">
        <EmailVerificationBanner />
        <div data-snap-section className="flex h-dvh snap-start snap-always flex-col">
          <LandingHeader adMode={adMode} />
          <div className="flex flex-1 flex-col justify-start pt-1">
            <LandingHero adMode={adMode} />
          </div>
        </div>
        <LandingFeatures adMode={adMode} />
        <LandingSocialProof adMode={adMode} />
        <LandingPlans adMode={adMode} />
      </div>
      {adMode ? <AdLandingStickyCta /> : <OnboardingTour variant="public" />}
    </div>
  );
}

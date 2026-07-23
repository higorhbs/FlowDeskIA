import { HeroCopyMotion } from "@/components/landing/HeroCopyMotion";
import { HeroVisualMobile } from "@/components/landing/HeroVisualMobile";
import { HeroVisualMotion } from "@/components/landing/HeroVisualMotion";
import {
  HeroOnlineBadge,
  HeroResponseCard,
  HeroStatsCard,
  HeroWhatsAppInset,
} from "@/components/landing/HeroVisualOverlays";

export function LandingHero({ adMode = false }: { adMode?: boolean }) {
  return (
    <section id="hero" className="pb-4 pt-1 sm:pb-6 sm:pt-2">
      <HeroCopyMotion adMode={adMode} />
      <HeroVisualMobile adMode={adMode} />
      <HeroVisualMotion
        rightTop={<HeroStatsCard />}
        rightBottom={<HeroWhatsAppInset />}
        leftTop={<HeroOnlineBadge />}
        leftBottom={<HeroResponseCard />}
      />
    </section>
  );
}

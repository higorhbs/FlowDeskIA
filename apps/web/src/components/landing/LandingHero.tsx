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
    <section id="hero" className="pb-20 pt-6 sm:pb-28 sm:pt-10">
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

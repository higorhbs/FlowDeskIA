"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { createHeroVariants } from "@/components/landing/hero-motion";
import { HeroCta } from "@/components/landing/HeroCta";

function useAnimateIn() {
  const [active, setActive] = useState(false);
  useEffect(() => setActive(true), []);
  return active;
}

type HeroVisualMotionProps = {
  rightTop: ReactNode;
  rightBottom: ReactNode;
  leftTop: ReactNode;
  leftBottom: ReactNode;
};

export function HeroVisualMotion({
  rightTop,
  rightBottom,
  leftTop,
  leftBottom,
}: HeroVisualMotionProps) {
  const active = useAnimateIn();
  const prefersReduced = useReducedMotion();
  const reduced = Boolean(active && prefersReduced);
  const v = createHeroVariants(reduced);
  const motionKey = active ? "run" : "idle";
  const withFloat = (alt?: boolean) =>
    active && !reduced
      ? alt
        ? ["show", "floatAlt"]
        : ["show", "float"]
      : "show";

  const enterKey = (id: string) => `${id}-${motionKey}`;
  const enter = () => ({
    initial: active ? ("hidden" as const) : false,
    animate: active ? ("show" as const) : undefined,
  });

  return (
    <div className="relative mx-auto mt-10 hidden max-w-6xl px-4 sm:mt-14 sm:px-6 md:block lg:px-8">
      <motion.div
        key={enterKey("visual")}
        className="relative isolate rounded-[1.75rem] sm:rounded-[2rem]"
        variants={v.visualContainer}
        {...enter()}
      >
        <motion.div
          variants={v.glow}
          aria-hidden
          className="pointer-events-none absolute -inset-3 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/15 via-brand-400/10 to-transparent blur-2xl sm:-inset-5"
        />

        <motion.div
          variants={v.imageFrame}
          className="relative aspect-[16/9] min-h-[300px] overflow-hidden rounded-[1.75rem] shadow-[0_20px_60px_-24px_rgba(22,163,74,0.18)] ring-1 ring-white/20 sm:min-h-[440px] sm:rounded-[2rem] lg:min-h-[520px]"
          style={{ transformPerspective: 1200 }}
        >
          <motion.div variants={v.imageInner} className="absolute inset-0">
            <Image
              src="/landing/hero-main.jpg"
              alt="Atendimento profissional no negócio local"
              fill
              priority
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 1152px"
            />
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/45" />
        </motion.div>

        <motion.div
          className="pointer-events-none absolute inset-0 rounded-[1.75rem] sm:rounded-[2rem]"
          variants={v.overlayContainer}
        >
          <motion.p
            variants={v.quote}
            className="pointer-events-auto absolute left-5 top-5 z-10 max-w-[220px] text-left text-sm font-medium leading-snug text-white [text-shadow:0_1px_12px_rgba(0,0,0,0.45)] sm:left-8 sm:top-8 sm:max-w-xs sm:text-base"
          >
            Mais confiabilidade, economia de tempo e dados para crescer seu negócio
            local.
          </motion.p>

          <motion.div
            variants={v.columnContainer}
            className="pointer-events-auto absolute right-4 top-4 z-10 flex flex-col items-end gap-2.5 sm:right-8 sm:top-8 sm:gap-3"
          >
            <motion.div variants={v.fromRight} animate={withFloat()}>
              {rightTop}
            </motion.div>
            <motion.div variants={v.fromRight} animate={withFloat(true)}>
              {rightBottom}
            </motion.div>
          </motion.div>

          <motion.div
            variants={v.columnContainer}
            className="pointer-events-auto absolute bottom-20 left-4 z-10 flex flex-col items-start gap-2.5 sm:bottom-8 sm:left-8 sm:gap-3"
          >
            <motion.div variants={v.fromLeft} animate={withFloat(true)}>
              {leftTop}
            </motion.div>
            <motion.div variants={v.fromLeft} animate={withFloat()}>
              {leftBottom}
            </motion.div>
          </motion.div>

          <motion.div
            variants={v.cta}
            animate={withFloat()}
            className="pointer-events-auto absolute inset-x-4 bottom-4 z-10 flex justify-center sm:inset-x-auto sm:right-8 sm:bottom-8 sm:justify-end"
          >
            <HeroCta />
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}

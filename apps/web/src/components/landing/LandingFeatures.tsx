"use client";

import dynamic from "next/dynamic";
import { PlayCircle, Workflow } from "lucide-react";
import { motion } from "motion/react";
import { LANDING_FEATURES } from "@/components/landing/features-data";

const Landing3DShowcase = dynamic(
  () => import("@/components/landing/Landing3DShowcase"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[420px] w-full animate-pulse rounded-[2rem] bg-gradient-to-br from-brand-100 via-white to-brand-50 sm:h-[480px] lg:h-[520px]" />
    ),
  },
);

function openOnboardingTour() {
  window.dispatchEvent(new Event("flowdesk:open-onboarding"));
}

export function LandingFeatures({ adMode = false }: { adMode?: boolean }) {
  return (
    <section
      id="recursos"
      aria-labelledby="features-heading"
      className="relative scroll-mt-24 overflow-hidden border-t border-brand-200/40 bg-gradient-to-b from-white via-[#f4faf6] to-white py-16 sm:py-24"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(22,163,74,0.08),transparent)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200/80 bg-white/80 px-3 py-1 text-xs font-semibold text-brand-800 shadow-sm backdrop-blur-sm">
            <Workflow className="size-3" aria-hidden />
            Como funciona
          </span>
          <h2
            id="features-heading"
            className="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
          >
            {adMode
              ? "Tudo que a IA faz pelo seu WhatsApp"
              : "Tudo que o FlowDesk faz sozinho no seu WhatsApp"}
          </h2>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            Do primeiro &ldquo;oi&rdquo; ao pagamento confirmado — sem você tocar no
            celular.
          </p>
        </div>

        <div className="mt-6 hidden md:block">
          <Landing3DShowcase />
        </div>

        <div className="mt-10 grid gap-4 sm:mt-14 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
          {LANDING_FEATURES.map(({ id, icon: Icon, title, desc }, index) => (
            <motion.div
              key={id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: (index % 4) * 0.06 }}
              className="group rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-300/70 hover:shadow-lg hover:shadow-brand-900/5"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors duration-300 group-hover:bg-brand-600 group-hover:text-white">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {desc}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={openOnboardingTour}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-brand-700 shadow-sm transition-colors hover:bg-brand-50"
          >
            <PlayCircle className="size-4" aria-hidden />
            Ver tour guiado do painel
          </button>
        </div>
      </div>
    </section>
  );
}

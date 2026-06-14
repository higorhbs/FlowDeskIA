import type { Metadata } from "next";
import { STARTER_TRIAL_DAYS } from "@flowdesk/shared";
import { LandingPageView } from "@/components/landing/LandingPageView";

export const metadata: Metadata = {
  title: "FlowDesk — Automatize seu WhatsApp com IA",
  description: `Teste grátis por ${STARTER_TRIAL_DAYS} dias. Agendamentos, vendas guiadas no WhatsApp, PIX e atendimento automático para seu negócio.`,
  robots: { index: false, follow: false },
};

export default function AdLandingPage() {
  return <LandingPageView adMode />;
}

import type { LucideIcon } from "lucide-react";
import {
  MessageSquare,
  Calendar,
  BookOpen,
  Settings,
  Banknote,
  Store,
  Phone,
  CircleDot,
} from "lucide-react";
import type { BusinessVocabulary } from "@flowdesk/shared";
import { IaIcon } from "@/lib/ia-brand";
import { panelHref } from "@/lib/business-nav";

export type PanelNavLayout = "sidebar" | "mobile" | "hub";

export type PanelNavLink = {
  href: string;
  icon: LucideIcon | typeof IaIcon;
  label: string;
  vocab: boolean;
  desc?: string;
  color?: string;
  badgeKey?: "conversations";
};

export function buildBusinessPanelLinks(opts: {
  businessId: string;
  vocabulary: BusinessVocabulary;
  pixEnabled: boolean;
  layout: PanelNavLayout;
}): PanelNavLink[] {
  const { businessId, vocabulary: v, pixEnabled, layout } = opts;

  if (layout === "sidebar") {
    return [
      { href: "/businesses", icon: Store, label: "Meu negócio", vocab: false },
      { href: panelHref(businessId, "conversations"), icon: MessageSquare, label: "Conversas", vocab: false, badgeKey: "conversations" },
      { href: panelHref(businessId, "faqs"), icon: IaIcon, label: "IA", vocab: false },
      { href: panelHref(businessId, "appointments"), icon: Calendar, label: v.bookingsNav, vocab: true },
      { href: panelHref(businessId, "catalog"), icon: BookOpen, label: v.catalogNav, vocab: true },
      { href: panelHref(businessId, "status"), icon: CircleDot, label: "Stories", vocab: false },
      ...(pixEnabled
        ? [{ href: panelHref(businessId, "payments"), icon: Banknote, label: "Pagamentos", vocab: false }]
        : []),
      { href: panelHref(businessId, "whatsapp"), icon: MessageSquare, label: "WhatsApp", vocab: false },
      { href: panelHref(businessId, "settings"), icon: Settings, label: "Configurações", vocab: false },
    ];
  }

  if (layout === "mobile") {
    return [
      { href: panelHref(businessId, "conversations"), icon: MessageSquare, label: "Conversas", vocab: false },
      { href: panelHref(businessId, "faqs"), icon: IaIcon, label: "IA", vocab: false },
      { href: panelHref(businessId, "appointments"), icon: Calendar, label: v.bookingsNavShort, vocab: true },
      { href: panelHref(businessId, "catalog"), icon: BookOpen, label: v.catalogNavShort, vocab: true },
      ...(pixEnabled
        ? [{ href: panelHref(businessId, "payments"), icon: Banknote, label: "Pagto", vocab: false }]
        : []),
      { href: panelHref(businessId, "settings"), icon: Settings, label: "Ajustes", vocab: false },
    ];
  }

  return [
    { href: panelHref(businessId, "conversations"), icon: MessageSquare, label: "Conversas", desc: "Histórico e atendimentos", color: "bg-blue-50 text-blue-600", vocab: false },
    { href: panelHref(businessId, "faqs"), icon: IaIcon, label: "IA", desc: "Menu, fluxo conversacional e perguntas automáticas", color: "bg-green-50 text-green-600", vocab: false },
    { href: panelHref(businessId, "appointments"), icon: Calendar, label: v.bookingsNav, desc: v.bookingsSectionDesc, color: "bg-violet-50 text-violet-600", vocab: true },
    { href: panelHref(businessId, "catalog"), icon: BookOpen, label: v.catalogNav, desc: `${v.catalogItemPlural} no catálogo`, color: "bg-amber-50 text-amber-600", vocab: true },
    ...(pixEnabled
      ? [{ href: panelHref(businessId, "payments"), icon: Banknote, label: "Pagamentos", desc: "PIX e recebimentos", color: "bg-emerald-50 text-emerald-600", vocab: false }]
      : []),
    { href: panelHref(businessId, "whatsapp"), icon: Phone, label: "WhatsApp", desc: "Conectar dispositivo", color: "bg-emerald-50 text-emerald-600", vocab: false },
    { href: panelHref(businessId, "settings"), icon: Settings, label: "Configurações", desc: "Dados, horários e mensagens", color: "bg-gray-100 text-gray-600", vocab: false },
  ];
}

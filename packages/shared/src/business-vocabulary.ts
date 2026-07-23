import { APP_DISPLAY_NAME } from "./brand.js";

export const BUSINESS_TYPE_ORDER = [
  "STORE",
  "BARBERSHOP",
  "RESTAURANT",
  "DENTAL",
  "OTHER",
] as const;

export type BusinessType = (typeof BUSINESS_TYPE_ORDER)[number];

/** Legado: SALON → BARBERSHOP (Salão de Beleza). */
export function normalizeBusinessType(type?: string | null): BusinessType {
  const raw = String(type ?? "").trim().toUpperCase();
  if (raw === "SALON") return "BARBERSHOP";
  if ((BUSINESS_TYPE_ORDER as readonly string[]).includes(raw)) return raw as BusinessType;
  return "OTHER";
}

export interface BusinessVocabulary {
  typeLabel: string;
  bookingsNav: string;
  bookingsNavShort: string;
  bookingsPageTitle: string;
  bookingSingular: string;
  bookingsPlural: string;
  bookingsSectionDesc: string;
  catalogNav: string;
  catalogNavShort: string;
  catalogPageTitle: string;
  catalogPageSubtitle: string;
  catalogItemSingular: string;
  catalogItemPlural: string;
  catalogEmptyTitle: string;
  catalogEmptyHint: string;
  catalogLimitToast: string;
  catalogPanelMenu: string;
  botBookingMenuLabel: string;
  botCatalogMenuLabel: string;
  botStartBookingTitle: string;
  botStartBookingPrompt: string;
  botBookingConfirmedTitle: string;
  botBookingServiceDefault: string;
  botMyBookingPrompt: string;
  botCatalogEmpty: string;
  botCatalogHeader: string;
  botCatalogFooter: string;
  botLegacyAppointmentHint: string;
  botLegacyCatalogHint: string;
  botAppointmentKeywords: string[];
  botMyBookingKeywords: string[];
  botCatalogKeywords: string[];
  bookingRequiresApproval: boolean;
  bookingAcceptLabel: string;
  bookingRejectLabel: string;
  bookingPendingSectionTitle: string;
  botBookingAwaitingTitle: string;
  botBookingAwaitingHint: string;
  botBookingAcceptedNotify: string;
  bookingStatusPending: string;
  bookingStatusConfirmed: string;
}

const MERGED_APPOINTMENT_KEYWORDS = [
  "agendamentos",
  "agendamento",
  "agendar",
  "marcar",
  "horário disponível",
  "horario disponivel",
  "reservar",
  "agenda",
  "pedido",
  "pedidos",
  "fazer pedido",
  "quero pedir",
  "encomenda",
  "delivery",
  "retirada",
  "consulta",
  "consultas",
  "agendar consulta",
  "marcar consulta",
  "quero comprar",
  "comprar",
  "pedir",
];

const MERGED_MY_BOOKING_KEYWORDS = [
  "meu agendamento",
  "ver agendamento",
  "ver meu agendamento",
  "consultar agendamento",
  "agendamento marcado",
  "qual meu horario",
  "qual meu horário",
  "horario marcado",
  "horário marcado",
  "meu pedido",
  "ver pedido",
  "status do pedido",
  "pedido marcado",
  "onde está meu pedido",
  "minha consulta",
  "ver consulta",
  "consulta marcada",
  "horário da consulta",
];

const MERGED_CATALOG_KEYWORDS = [
  "cardápio",
  "cardapio",
  "catálogo",
  "catalogo",
  "menu",
  "serviços",
  "servicos",
  "produtos",
  "preços",
  "precos",
  "pratos",
  "o que tem",
  "tratamentos",
  "valores",
  "procedimentos",
  "o que vocês vendem",
  "o que voces vendem",
];

const DEFAULT: BusinessVocabulary = {
  typeLabel: "Negócio",
  bookingsNav: "Agendamentos/Pedidos",
  bookingsNavShort: "Agenda",
  bookingsPageTitle: "Agendamentos/Pedidos",
  bookingSingular: "Agendamento",
  bookingsPlural: "Agendamentos/Pedidos",
  bookingsSectionDesc: "Agenda e horários",
  catalogNav: "Produtos",
  catalogNavShort: "Produtos",
  catalogPageTitle: "Produtos",
  catalogPageSubtitle: "Produtos exibidos quando o cliente pede preços ou lista",
  catalogItemSingular: "produto",
  catalogItemPlural: "produtos",
  catalogEmptyTitle: "Nenhum produto cadastrado",
  catalogEmptyHint: "Cadastre produtos para a IA enviar no WhatsApp.",
  catalogLimitToast: "produtos no catálogo",
  catalogPanelMenu: "Produtos",
  botBookingMenuLabel: "Agendamentos/Pedidos",
  botCatalogMenuLabel: "Produtos",
  botStartBookingTitle: "Agendamentos/Pedidos",
  botStartBookingPrompt: "Qual data você prefere? (ex: *15/06* ou *amanhã*)",
  botBookingConfirmedTitle: "Agendamento confirmado",
  botBookingServiceDefault: "Agendamento",
  botMyBookingPrompt: "meu agendamento",
  botCatalogEmpty:
    `Ainda não há *produtos* cadastrados.\n\nCadastre no painel ${APP_DISPLAY_NAME} (menu Produtos).`,
  botCatalogHeader: "Produtos",
  botCatalogFooter:
    "\nPara agendar ou pedir, digite *agendar* ou escolha a opção no *menu*.\nPara acompanhar: *meu agendamento*.",
  botLegacyAppointmentHint: "Para agendar ou pedir, informe a data (ex: *15/06*) ou digite *agendar*.",
  botLegacyCatalogHint: "Veja nossos produtos — digite *produtos* ou *preços*.",
  botAppointmentKeywords: MERGED_APPOINTMENT_KEYWORDS,
  botMyBookingKeywords: MERGED_MY_BOOKING_KEYWORDS,
  botCatalogKeywords: MERGED_CATALOG_KEYWORDS,
  bookingRequiresApproval: false,
  bookingAcceptLabel: "Aceitar",
  bookingRejectLabel: "Recusar",
  bookingPendingSectionTitle: "Aguardando sua confirmação",
  botBookingAwaitingTitle: "Solicitação registrada",
  botBookingAwaitingHint: "Você receberá uma mensagem quando for confirmado.",
  botBookingAcceptedNotify: "Seu agendamento foi confirmado",
  bookingStatusPending: "Pendente",
  bookingStatusConfirmed: "Confirmado",
};

const APPROVAL_OVERRIDES: Partial<BusinessVocabulary> = {
  bookingRequiresApproval: true,
  bookingPendingSectionTitle: "Aguardando confirmação",
  botBookingAwaitingTitle: "Solicitação recebida",
  botBookingAwaitingHint: "Você receberá uma mensagem quando for confirmado.",
  botBookingAcceptedNotify: "Sua solicitação foi confirmada",
  bookingStatusPending: "Aguardando aceite",
  bookingStatusConfirmed: "Confirmado",
};

const BY_TYPE: Record<BusinessType, BusinessVocabulary> = {
  BARBERSHOP: {
    ...DEFAULT,
    typeLabel: "Salão de Beleza",
    bookingsNav: "Agendamentos",
    bookingsNavShort: "Agenda",
    bookingsPageTitle: "Agendamentos",
    bookingSingular: "Agendamento",
    bookingsPlural: "Agendamentos",
  },
  RESTAURANT: {
    ...DEFAULT,
    typeLabel: "Restaurante",
    ...APPROVAL_OVERRIDES,
    bookingsNav: "Pedidos",
    bookingsNavShort: "Pedidos",
    bookingsPageTitle: "Pedidos",
    bookingSingular: "Pedido",
    bookingsPlural: "Pedidos",
    bookingsSectionDesc: "Pedidos e entregas",
    botBookingMenuLabel: "Pedidos",
    botStartBookingTitle: "Pedidos",
    botBookingServiceDefault: "Pedido",
    botMyBookingPrompt: "meu pedido",
  },
  DENTAL: { ...DEFAULT, typeLabel: "Clínica", ...APPROVAL_OVERRIDES },
  STORE: { ...DEFAULT, typeLabel: "Comércio", ...APPROVAL_OVERRIDES },
  OTHER: DEFAULT,
};

export function getBusinessVocabulary(type?: string | null): BusinessVocabulary {
  if (!type) return DEFAULT;
  return BY_TYPE[normalizeBusinessType(type)] ?? DEFAULT;
}

export function businessRequiresBookingApproval(
  type?: string | null,
  appointmentBot?: { requiresApproval?: boolean } | null,
): boolean {
  if (type === "BARBERSHOP") {
    return appointmentBot?.requiresApproval === true;
  }
  return getBusinessVocabulary(type).bookingRequiresApproval;
}

export function getBookingStatusLabel(type: string | null | undefined, status: string): string {
  const v = getBusinessVocabulary(type);
  const map: Record<string, string> = {
    PENDING: v.bookingStatusPending,
    CONFIRMED: v.bookingStatusConfirmed,
    CANCELLED: "Cancelado",
    COMPLETED: "Concluído",
    NO_SHOW: "Não compareceu",
  };
  return map[status] ?? status;
}

export function getOrderStatusLabel(status: string, fulfillment?: string | null): string {
  const map: Record<string, string> = {
    PENDING: "Aguardando confirmação",
    CONFIRMED: "Confirmado",
    PREPARING: "Preparando",
    READY: fulfillment === "DELIVERY" ? "Saiu para entrega" : "Pronto para retirada",
    DELIVERED: fulfillment === "DELIVERY" ? "Entregue" : "Retirado",
    CANCELLED: "Cancelado",
  };
  return map[status] ?? status;
}

export function getIntentKeywordsForType(type?: string | null) {
  const v = getBusinessVocabulary(type);
  return {
    APPOINTMENT: [...new Set([...v.botAppointmentKeywords])],
    MY_APPOINTMENT: [...new Set([...v.botMyBookingKeywords])],
    CATALOG: [...new Set([...v.botCatalogKeywords])],
  };
}

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  STORE: "Comércio local",
  BARBERSHOP: "Salão de Beleza",
  RESTAURANT: "Restaurante",
  DENTAL: "Dentista / Clínica",
  OTHER: "Outro",
};

export function getBusinessTypeLabel(
  type?: BusinessType | string | null,
  typeLabel?: string | null
): string {
  const custom = typeLabel?.trim();
  const normalized = type ? normalizeBusinessType(type) : null;
  if (normalized === "OTHER" && custom) return custom;
  if (normalized) return BUSINESS_TYPE_LABELS[normalized];
  return custom || "Outro";
}

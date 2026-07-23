import type { Business, BusinessCreateInput } from "./types.js";
import {
  normalizeBusinessType,
  normalizeLeadCaptureFlow,
  normalizeResumeFlowConfig,
  normalizeAppointmentBotConfig,
  normalizeOrderBotConfig,
  normalizePrinterConfig,
  DEFAULT_WEEKLY_MENU_KEYWORDS,
  businessSupportsLeadFlow,
  type LeadCaptureFlow,
  type ResumeFlowConfig,
  type AppointmentBotConfig,
  type OrderBotConfig,
  type WeeklyMenuConfig,
  type PrinterConfig,
} from "@flowdesk/shared";

export function stripUndefined<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) as T;
}

export function serializeLeadFlowForFirestore(flow: LeadCaptureFlow): Record<string, unknown> {
  const normalized = normalizeLeadCaptureFlow(flow);
  return {
    enabled: normalized.enabled,
    startOnGreeting: normalized.startOnGreeting,
    triggerKeywords: normalized.triggerKeywords,
    startNodeId: normalized.startNodeId,
    nodes: normalized.nodes.map((node) =>
      stripUndefined({
        id: node.id,
        text: node.text,
        invalidReply: node.invalidReply,
        imageUrl: node.imageUrl,
        imageStoragePath: node.imageStoragePath,
        mediaType: node.mediaType,
        entryKeywords: node.entryKeywords?.length ? node.entryKeywords : undefined,
        idleFollowUpEnabled: node.idleFollowUpEnabled ? true : undefined,
        idleFollowUpMinutes: node.idleFollowUpMinutes,
        idleFollowUpMessage: node.idleFollowUpMessage,
        buttons: node.buttons.map((btn) =>
          stripUndefined({
            id: btn.id,
            label: btn.label,
            nextNodeId: btn.nextNodeId,
          }),
        ),
      }),
    ),
  };
}

function readLeadFlow(raw: unknown): Business["leadFlow"] {
  if (!raw || typeof raw !== "object") return undefined;
  return normalizeLeadCaptureFlow(raw as LeadCaptureFlow);
}

function readResumeFlow(raw: unknown): Business["resumeFlow"] {
  if (!raw || typeof raw !== "object") return undefined;
  const source = raw as ResumeFlowConfig;
  const cfg = normalizeResumeFlowConfig(source);
  if (source.notifySelf === true) return { ...cfg, notifySelf: true };
  return cfg;
}

function readAppointmentBot(raw: unknown): Business["appointmentBot"] {
  if (!raw || typeof raw !== "object") return undefined;
  return normalizeAppointmentBotConfig(raw as AppointmentBotConfig);
}

function readOrderBot(raw: unknown): Business["orderBot"] {
  if (!raw || typeof raw !== "object") return undefined;
  return normalizeOrderBotConfig(raw as OrderBotConfig);
}

export function serializeOrderBotForFirestore(flow: OrderBotConfig): Record<string, unknown> {
  const normalized = normalizeOrderBotConfig(flow);
  return {
    enabled: normalized.enabled,
    triggerKeywords: normalized.triggerKeywords,
    startMessage: normalized.startMessage,
    fulfillmentDelivery: normalized.fulfillmentDelivery,
    fulfillmentPickup: normalized.fulfillmentPickup,
    paymentMethods: normalized.paymentMethods,
    completedMessage: normalized.completedMessage,
    awaitingMessage: normalized.awaitingMessage,
    requiresApproval: normalized.requiresApproval === true,
  };
}

function readPrinterConfig(raw: unknown): Business["printerConfig"] {
  if (!raw || typeof raw !== "object") return undefined;
  return normalizePrinterConfig(raw as PrinterConfig);
}

export function serializePrinterConfigForFirestore(cfg: PrinterConfig): Record<string, unknown> {
  const normalized = normalizePrinterConfig(cfg);
  return {
    enabled: normalized.enabled,
    ip: normalized.ip,
    port: normalized.port,
    copies: normalized.copies,
  };
}

function readWeeklyMenu(raw: unknown): Business["weeklyMenu"] {
  if (!raw || typeof raw !== "object") return undefined;
  const source = raw as Partial<WeeklyMenuConfig>;
  if (!Array.isArray(source.days)) return undefined;
  const triggerKeywords = Array.isArray(source.triggerKeywords)
    ? (source.triggerKeywords as string[]).map((k) => String(k).trim()).filter(Boolean)
    : [];
  return {
    enabled: source.enabled === true,
    triggerKeywords: triggerKeywords.length ? triggerKeywords : [...DEFAULT_WEEKLY_MENU_KEYWORDS],
    days: source.days,
    responsePrefix: typeof source.responsePrefix === "string" ? source.responsePrefix : undefined,
  };
}

export function serializeAppointmentBotForFirestore(
  flow: AppointmentBotConfig,
): Record<string, unknown> {
  const normalized = normalizeAppointmentBotConfig(flow);
  return {
    startMessage: normalized.startMessage,
    clientInputExample: normalized.clientInputExample,
    completedMessage: normalized.completedMessage,
    awaitingMessage: normalized.awaitingMessage,
    requiresApproval: normalized.requiresApproval === true,
  };
}

export function serializeResumeFlowForFirestore(flow: ResumeFlowConfig): Record<string, unknown> {
  const normalized = normalizeResumeFlowConfig(flow);
  return stripUndefined({
    enabled: normalized.enabled,
    documentLabel: normalized.documentLabel,
    triggerKeywords: normalized.triggerKeywords,
    notifyPhone: normalized.notifyPhone,
    notifySelf: normalized.notifySelf === true,
    welcomeMessage: normalized.welcomeMessage,
    successMessage: normalized.successMessage,
  });
}

export function buildBusinessCreateRecord(
  tenantId: string,
  id: string,
  data: BusinessCreateInput,
  ts: string
): Record<string, unknown> {
  return stripUndefined({
    id,
    tenantId,
    name: data.name.trim(),
    type: data.type,
    typeLabel: data.typeLabel?.trim(),
    phone: data.phone,
    address: data.address?.trim(),
    description: data.description?.trim(),
    workingHours: data.workingHours ?? {},
    timezone: data.timezone ?? "America/Sao_Paulo",
    greetingMsg: data.greetingMsg ?? "Olá! Como posso ajudar?",
    awayMsg: data.awayMsg ?? "Olá! No momento estamos fechados, mas logo retornamos. Deixe sua mensagem!",
    thanksEnabled: true,
    attendantEnabled: true,
    manualAttendantPrefixEnabled: true,
    createdAt: ts,
    updatedAt: ts,
  });
}

export function normalizeBusiness(id: string, raw: Record<string, unknown>): Business {
  const type = normalizeBusinessType(typeof raw.type === "string" ? raw.type : undefined);
  let leadFlow = readLeadFlow(raw.leadFlow);
  if (leadFlow && !businessSupportsLeadFlow(type)) {
    leadFlow = { ...leadFlow, enabled: false };
  }
  return {
    id,
    tenantId: String(raw.tenantId ?? ""),
    name: String(raw.name ?? ""),
    type,
    phone: String(raw.phone ?? ""),
    createdAt: String(raw.createdAt ?? ""),
    updatedAt: String(raw.updatedAt ?? ""),
    description: typeof raw.description === "string" ? raw.description : undefined,
    typeLabel: typeof raw.typeLabel === "string" ? raw.typeLabel : undefined,
    address: typeof raw.address === "string" ? raw.address : undefined,
    logoUrl: typeof raw.logoUrl === "string" ? raw.logoUrl : undefined,
    workingHours:
      raw.workingHours && typeof raw.workingHours === "object"
        ? (raw.workingHours as Record<string, unknown>)
        : {},
    specialHours: raw.specialHours as Business["specialHours"],
    lunchBreak: raw.lunchBreak as Business["lunchBreak"],
    lunchMsg: typeof raw.lunchMsg === "string" ? raw.lunchMsg : undefined,
    timezone: typeof raw.timezone === "string" ? raw.timezone : "America/Sao_Paulo",
    greetingMsg:
      typeof raw.greetingMsg === "string" ? raw.greetingMsg : "Olá! Como posso ajudar?",
    awayMsg:
      typeof raw.awayMsg === "string"
        ? raw.awayMsg
        : "Olá! No momento estamos fechados, mas logo retornamos. Deixe sua mensagem!",
    botMenu: raw.botMenu as Business["botMenu"],
    botMenuEnabled: raw.botMenuEnabled !== false,
    greetingEnabled: raw.greetingEnabled !== false,
    botAutoReplyEnabled: raw.botAutoReplyEnabled !== false,
    thanksMsg: typeof raw.thanksMsg === "string" ? raw.thanksMsg : undefined,
    thanksEnabled: raw.thanksEnabled !== false,
    attendantName: typeof raw.attendantName === "string" ? raw.attendantName : undefined,
    attendantNames: Array.isArray(raw.attendantNames)
      ? (raw.attendantNames as string[])
      : undefined,
    attendantEnabled: raw.attendantEnabled !== false,
    manualAttendantPrefixEnabled: raw.manualAttendantPrefixEnabled !== false,
    leadFlow,
    resumeFlow: readResumeFlow(raw.resumeFlow),
    weeklyMenu: readWeeklyMenu(raw.weeklyMenu),
    appointmentBot: readAppointmentBot(raw.appointmentBot),
    orderBot: readOrderBot(raw.orderBot),
    printerConfig: readPrinterConfig(raw.printerConfig),
    appointmentBufferMins:
      typeof raw.appointmentBufferMins === "number" && raw.appointmentBufferMins >= 0
        ? raw.appointmentBufferMins
        : undefined,
    dailyReportEnabled: raw.dailyReportEnabled === true,
    dailyReportHour:
      typeof raw.dailyReportHour === "number" && raw.dailyReportHour >= 0 && raw.dailyReportHour <= 23
        ? raw.dailyReportHour
        : undefined,
    dailyReportMinute:
      typeof raw.dailyReportMinute === "number" && raw.dailyReportMinute >= 0 && raw.dailyReportMinute <= 59
        ? raw.dailyReportMinute
        : undefined,
    isConnected: raw.isConnected === true,
  };
}

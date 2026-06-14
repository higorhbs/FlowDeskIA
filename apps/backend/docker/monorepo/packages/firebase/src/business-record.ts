import type { Business, BusinessCreateInput, BusinessType } from "./types.js";
import { normalizeLeadCaptureFlow, type LeadCaptureFlow } from "@flowdesk/shared";

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
  return {
    id,
    tenantId: String(raw.tenantId ?? ""),
    name: String(raw.name ?? ""),
    type: raw.type as BusinessType,
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
    botMenuEnabled: raw.botMenuEnabled === true,
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
    leadFlow: readLeadFlow(raw.leadFlow),
    isConnected: raw.isConnected === true,
  };
}

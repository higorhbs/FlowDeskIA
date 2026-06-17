export const LEAD_FLOW_MAX_BUTTONS = 3;
export const LEAD_FLOW_MAX_MEDIA_BYTES = 16 * 1024 * 1024;
export const LEAD_FLOW_MAX_MEDIA_LABEL = "16 MB";
export const LEAD_FLOW_MEDIA_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,.jpg,.jpeg,.png,.webp,.gif,.mp4,.mov";
export const DEFAULT_LEAD_FLOW_INVALID_REPLY =
  "👇 Responda com o número da opção (ex: *1*, *2* ou *3*) ou toque em um botão 😊";
export const DEFAULT_LEAD_FLOW_IDLE_FOLLOW_UP_MINUTES = 60;
export const DEFAULT_LEAD_FLOW_IDLE_FOLLOW_UP_MESSAGE =
  "Oi {nome}! Ficou com alguma dúvida sobre o {negocio}? Estou por aqui se precisar 😊";

export type LeadFlowMediaType = "image" | "video" | "gif";

export interface LeadFlowButton {
  id: string;
  label: string;
  nextNodeId?: string;
}

export interface LeadFlowNode {
  id: string;
  text: string;
  imageUrl?: string;
  imageStoragePath?: string;
  mediaType?: LeadFlowMediaType;
  buttons: LeadFlowButton[];
  invalidReply?: string;
  entryKeywords?: string[];
  idleFollowUpEnabled?: boolean;
  idleFollowUpMinutes?: number;
  idleFollowUpMessage?: string;
}

export interface LeadCaptureFlow {
  enabled: boolean;
  startOnGreeting: boolean;
  triggerKeywords: string[];
  startNodeId: string;
  nodes: LeadFlowNode[];
}

export function newLeadFlowId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function defaultLeadCaptureFlow(): LeadCaptureFlow {
  const startId = "node_1";
  return {
    enabled: false,
    startOnGreeting: false,
    triggerKeywords: [],
    startNodeId: startId,
    nodes: [
      {
        id: startId,
        text: "",
        invalidReply: DEFAULT_LEAD_FLOW_INVALID_REPLY,
        buttons: [],
      },
    ],
  };
}

export function normalizeLeadCaptureFlow(raw?: LeadCaptureFlow | null): LeadCaptureFlow {
  const base = defaultLeadCaptureFlow();
  if (!raw) return base;
  const nodes = (raw.nodes ?? []).map((node, index) => normalizeLeadFlowNode(node, index));
  const startNodeId =
    nodes.some((n) => n.id === raw.startNodeId) ? raw.startNodeId : nodes[0]?.id ?? base.startNodeId;
  return {
    enabled: raw.enabled === true,
    startOnGreeting: raw.startOnGreeting !== false,
    triggerKeywords: (raw.triggerKeywords ?? base.triggerKeywords)
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean),
    startNodeId,
    nodes: nodes.length ? nodes : base.nodes,
  };
}

function normalizeLeadFlowNode(raw: Partial<LeadFlowNode>, index: number): LeadFlowNode {
  const id = raw.id?.trim() || `node_${index + 1}`;
  const buttons = (raw.buttons ?? []).slice(0, LEAD_FLOW_MAX_BUTTONS).map((btn, btnIndex) =>
    normalizeLeadFlowButton(btn, btnIndex)
  );
  const imageUrl = raw.imageUrl?.trim() || undefined;
  const imageStoragePath = raw.imageStoragePath?.trim() || undefined;
  const mediaType = normalizeLeadFlowMediaType(raw.mediaType, imageUrl, imageStoragePath);
  return {
    id,
    text: raw.text?.trim() || "",
    imageUrl,
    imageStoragePath: raw.imageStoragePath?.trim() || undefined,
    mediaType,
    invalidReply: raw.invalidReply?.trim() || DEFAULT_LEAD_FLOW_INVALID_REPLY,
    entryKeywords: (raw.entryKeywords ?? [])
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean),
    idleFollowUpEnabled: raw.idleFollowUpEnabled === true,
    idleFollowUpMinutes: normalizeIdleFollowUpMinutes(raw.idleFollowUpMinutes),
    idleFollowUpMessage: raw.idleFollowUpMessage?.trim() || undefined,
    buttons,
  };
}

function normalizeIdleFollowUpMinutes(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(1440, Math.max(5, Math.round(n)));
}

function normalizeLeadFlowMediaType(
  raw: unknown,
  imageUrl?: string,
  imageStoragePath?: string,
): LeadFlowMediaType | undefined {
  if (!imageUrl) return undefined;
  const hint = `${imageUrl} ${imageStoragePath ?? ""}`.toLowerCase();
  if (hint.includes(".gif")) return "gif";
  if (hint.includes(".mp4") || hint.includes(".mov")) return "video";
  if (raw === "video" || raw === "gif" || raw === "image") return raw;
  return "image";
}

export function countLeadFlowMediaNodes(flow: LeadCaptureFlow): number {
  return flow.nodes.filter((n) => Boolean(n.imageUrl?.trim())).length;
}

function normalizeLeadFlowButton(raw: Partial<LeadFlowButton>, index: number): LeadFlowButton {
  return {
    id: raw.id?.trim() || `btn_${index + 1}`,
    label: raw.label?.trim() || `Opção ${index + 1}`,
    nextNodeId: raw.nextNodeId?.trim() || undefined,
  };
}

export function findLeadFlowNode(flow: LeadCaptureFlow, nodeId: string): LeadFlowNode | null {
  return flow.nodes.find((n) => n.id === nodeId) ?? null;
}

function escapeKeywordRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Evita falso positivo (ex.: keyword "trial" dentro de "industrial"). */
export function flowKeywordHit(text: string, keywords: string[]): boolean {
  const normalized = text.toLowerCase().trim();
  if (!normalized || !keywords.length) return false;
  const padded = ` ${normalized} `;
  const boundary = String.raw`[\s,.;:!?¿¡"'()\[\]{}«»—–-]`;
  return keywords.some((raw) => {
    const kw = raw.trim().toLowerCase();
    if (!kw) return false;
    if (normalized === kw) return true;
    if (kw.includes(" ")) return normalized.includes(kw);
    const re = new RegExp(`(?:^|${boundary})${escapeKeywordRegex(kw)}(?:$|${boundary})`);
    return re.test(padded);
  });
}

export function leadFlowTriggerMatch(text: string, keywords: string[]): boolean {
  return flowKeywordHit(text, keywords);
}

export function matchesLeadFlowRestartTrigger(
  flow: LeadCaptureFlow,
  messageBody: string,
  isGreeting = false,
): boolean {
  if (flow.startOnGreeting && isGreeting) return true;
  return leadFlowTriggerMatch(messageBody, flow.triggerKeywords);
}

export function resolveLeadFlowButton(
  node: LeadFlowNode,
  messageBody: string
): LeadFlowButton | null {
  const body = messageBody.trim();
  if (!body || !node.buttons.length) return null;

  const byId = node.buttons.find((b) => b.id === body);
  if (byId) return byId;

  const lower = body.toLowerCase();
  const byLabel = node.buttons.find((b) => b.label.toLowerCase() === lower);
  if (byLabel) return byLabel;

  const byPartial = node.buttons.find((b) => {
    const label = b.label.toLowerCase();
    if (lower.length < 3 || lower.includes(" ")) return false;
    return label.includes(lower);
  });
  if (byPartial) return byPartial;

  const numMatch = body.match(/^(\d{1,2})[\.\)\s]*$/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n >= 1 && n <= node.buttons.length) return node.buttons[n - 1] ?? null;
  }

  return null;
}

export function isLeadFlowBackCommand(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .trim()
    .replace(/^[!?.,"']+|[!?.,"']+$/g, "");
  return (
    normalized === "voltar" ||
    normalized === "anterior" ||
    normalized === "volta" ||
    normalized === "retroceder"
  );
}

function matchLeadFlowButtonByIdOrLabel(
  node: LeadFlowNode,
  body: string,
): LeadFlowButton | null {
  const byId = node.buttons.find((b) => b.id === body);
  if (byId) return byId;
  const lower = body.toLowerCase();
  return node.buttons.find((b) => b.label.toLowerCase() === lower) ?? null;
}

export function isLeadFlowBackIntent(
  node: LeadFlowNode | null,
  messageBody: string,
  flow?: LeadCaptureFlow,
): boolean {
  if (isLeadFlowBackCommand(messageBody)) return true;
  const body = messageBody.trim();
  if (!body) return false;
  const nodes = node ? [node] : flow?.nodes ?? [];
  for (const n of nodes) {
    const btn = matchLeadFlowButtonByIdOrLabel(n, body);
    if (btn && isLeadFlowBackCommand(btn.label)) return true;
  }
  return false;
}

export function findLeadFlowButtonMatch(
  flow: LeadCaptureFlow,
  messageBody: string,
): { node: LeadFlowNode; button: LeadFlowButton } | null {
  for (const node of flow.nodes) {
    const button = resolveLeadFlowButtonExact(node, messageBody);
    if (button) return { node, button };
  }
  return null;
}

function resolveLeadFlowButtonExact(
  node: LeadFlowNode,
  messageBody: string,
): LeadFlowButton | null {
  const body = messageBody.trim();
  if (!body || !node.buttons.length) return null;

  const byId = node.buttons.find((b) => b.id === body);
  if (byId) return byId;

  const lower = body.toLowerCase();
  const byLabel = node.buttons.find((b) => b.label.toLowerCase() === lower);
  if (byLabel) return byLabel;

  const numMatch = body.match(/^(\d{1,2})[\.\)\s]*$/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n >= 1 && n <= node.buttons.length) return node.buttons[n - 1] ?? null;
  }

  return null;
}

function leadFlowEntryKeywordHit(messageBody: string, keywords: string[]): boolean {
  return flowKeywordHit(messageBody, keywords);
}

export function findLeadFlowEntryByKeyword(
  flow: LeadCaptureFlow,
  messageBody: string,
): LeadFlowNode | null {
  for (const node of flow.nodes) {
    const keywords = node.entryKeywords ?? [];
    if (keywords.length && leadFlowEntryKeywordHit(messageBody, keywords)) return node;
  }
  return null;
}

export function resolveLeadFlowEntryNode(
  flow: LeadCaptureFlow,
  messageBody: string,
): LeadFlowNode | null {
  const body = messageBody.trim().toLowerCase();
  if (!body) return findLeadFlowNode(flow, flow.startNodeId);

  for (const node of flow.nodes) {
    const keywords = node.entryKeywords ?? [];
    if (leadFlowEntryKeywordHit(messageBody, keywords)) {
      return node;
    }
  }

  for (const node of flow.nodes) {
    for (const btn of node.buttons) {
      if (btn.label.toLowerCase() === body && btn.nextNodeId) {
        const target = findLeadFlowNode(flow, btn.nextNodeId);
        if (target) return target;
      }
    }
  }

  return findLeadFlowNode(flow, flow.startNodeId);
}

const CHAT_GREETINGS = [
  "oi",
  "olá",
  "ola",
  "bom dia",
  "boa tarde",
  "boa noite",
  "hello",
  "hi",
  "hey",
  "e aí",
  "e ai",
  "salve",
  "menu",
] as const;

export function isChatGreeting(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .trim()
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/gu, "")
    .replace(/^[!?.,"']+|[!?.,"']+$/g, "")
    .trim();
  if (!normalized) return false;
  return CHAT_GREETINGS.some(
    (g) => normalized === g || normalized.startsWith(`${g} `) || normalized.startsWith(`${g},`)
  );
}

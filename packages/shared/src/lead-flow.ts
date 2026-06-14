export const LEAD_FLOW_MAX_BUTTONS = 3;
export const LEAD_FLOW_MEDIA_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime";
export const DEFAULT_LEAD_FLOW_INVALID_REPLY =
  "👇 Responda com o número da opção (ex: *1*, *2* ou *3*) ou toque em um botão 😊";

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
  const mediaType = normalizeLeadFlowMediaType(raw.mediaType, imageUrl);
  return {
    id,
    text: raw.text?.trim() || "",
    imageUrl,
    imageStoragePath: raw.imageStoragePath?.trim() || undefined,
    mediaType,
    invalidReply: raw.invalidReply?.trim() || DEFAULT_LEAD_FLOW_INVALID_REPLY,
    buttons,
  };
}

function normalizeLeadFlowMediaType(
  raw: unknown,
  imageUrl?: string,
): LeadFlowMediaType | undefined {
  if (!imageUrl) return undefined;
  if (raw === "video" || raw === "gif" || raw === "image") return raw;
  const lower = imageUrl.toLowerCase();
  if (lower.includes(".gif")) return "gif";
  if (lower.includes(".mp4") || lower.includes(".mov")) return "video";
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

export function leadFlowTriggerMatch(text: string, keywords: string[]): boolean {
  const normalized = text.toLowerCase().trim();
  if (!normalized || !keywords.length) return false;
  return keywords.some((kw) => normalized.includes(kw));
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
    return label.includes(lower) || lower.includes(label);
  });
  if (byPartial && lower.length >= 2) return byPartial;

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
  return normalized === "voltar" || normalized === "anterior";
}

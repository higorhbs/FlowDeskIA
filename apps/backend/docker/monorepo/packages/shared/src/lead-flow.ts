export const LEAD_FLOW_MAX_BUTTONS = 3;
export const DEFAULT_LEAD_FLOW_INVALID_REPLY =
  "👇 Por favor, clique em um dos botões abaixo pra continuar 😊";

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
  return {
    id,
    text: raw.text?.trim() || "",
    imageUrl: raw.imageUrl?.trim() || undefined,
    imageStoragePath: raw.imageStoragePath?.trim() || undefined,
    invalidReply: raw.invalidReply?.trim() || DEFAULT_LEAD_FLOW_INVALID_REPLY,
    buttons,
  };
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
  if (!body) return null;
  const byId = node.buttons.find((b) => b.id === body);
  if (byId) return byId;
  const lower = body.toLowerCase();
  return node.buttons.find((b) => b.label.toLowerCase() === lower) ?? null;
}

export function isLeadFlowBackCommand(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .trim()
    .replace(/^[!?.,"']+|[!?.,"']+$/g, "");
  return normalized === "voltar" || normalized === "anterior";
}

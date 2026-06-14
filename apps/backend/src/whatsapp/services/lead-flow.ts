import {
  DEFAULT_LEAD_FLOW_INVALID_REPLY,
  findLeadFlowNode,
  isLeadFlowBackCommand,
  leadFlowTriggerMatch,
  normalizeLeadCaptureFlow,
  renderTemplate,
  resolveLeadFlowButton,
  type LeadCaptureFlow,
  type LeadFlowNode,
} from "@flowdesk/shared";
import type { Conversation } from "@flowdesk/firebase";
import type { BotContext, BotResponse } from "./bot.js";

const LEAD_FLOW_AT_START_MSG = "Você já está no início do fluxo.";

type FlowState = { step: "LEAD_FLOW"; data: Record<string, string> };

function parseHistory(raw?: string): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function serializeHistory(history: string[]): string {
  return JSON.stringify(history);
}

function flowVars(business: { name: string }, customerName?: string) {
  return { nome: customerName ?? "cliente", negocio: business.name };
}

export function isLeadFlowActive(state?: { step: string } | null): boolean {
  return state?.step === "LEAD_FLOW";
}

export function getLeadFlowConfig(business: { leadFlow?: LeadCaptureFlow | null }): LeadCaptureFlow | null {
  const flow = normalizeLeadCaptureFlow(business.leadFlow);
  if (!flow.enabled || !flow.nodes.length) return null;
  if (!findLeadFlowNode(flow, flow.startNodeId)) return null;
  return flow;
}

export function shouldStartLeadFlow(
  business: { leadFlow?: LeadCaptureFlow | null },
  messageBody: string,
  greeting: boolean,
): boolean {
  const flow = getLeadFlowConfig(business);
  if (!flow) return false;
  if (greeting && flow.startOnGreeting) return true;
  return leadFlowTriggerMatch(messageBody, flow.triggerKeywords);
}

export function leadFlowNodeToResponses(
  node: LeadFlowNode,
  vars: Record<string, string>,
): BotResponse[] {
  const text = renderTemplate(node.text, vars);
  const out: BotResponse[] = [];
  if (node.imageUrl) out.push({ text: "", imageUrl: node.imageUrl });
  if (node.buttons.length) {
    out.push({
      text,
      buttons: node.buttons.map((b) => ({ id: b.id, label: b.label })),
    });
  } else if (text.trim()) {
    out.push({ text });
  }
  return out;
}

function leadFlowState(
  nodeId: string,
  history: string[] = [],
): { step: "LEAD_FLOW"; data: Record<string, string> } {
  return { step: "LEAD_FLOW", data: { nodeId, history: serializeHistory(history) } };
}

async function sendLeadFlowNode(
  business: { id: string; name: string },
  conversation: Conversation,
  node: LeadFlowNode,
  vars: Record<string, string>,
  saveAndReturn: (businessId: string, conversationId: string, responses: BotResponse[]) => Promise<void>,
): Promise<BotResponse[]> {
  const out = leadFlowNodeToResponses(node, vars);
  if (!out.length) return [];
  await saveAndReturn(business.id, conversation.id, out);
  return out;
}

export async function startLeadFlow(
  business: { id: string; name: string; leadFlow?: LeadCaptureFlow | null },
  conversation: Conversation,
  customerName: string | undefined,
  sessionKey: string,
  conversationState: Map<string, { step: string; data: Record<string, string> }>,
  saveAndReturn: (businessId: string, conversationId: string, responses: BotResponse[]) => Promise<void>,
): Promise<BotResponse[]> {
  const flow = getLeadFlowConfig(business);
  if (!flow) return [];
  const node = findLeadFlowNode(flow, flow.startNodeId);
  if (!node) return [];
  conversationState.set(sessionKey, leadFlowState(node.id));
  return sendLeadFlowNode(business, conversation, node, flowVars(business, customerName), saveAndReturn);
}

async function handleLeadFlowBack(
  ctx: BotContext,
  business: { id: string; name: string; leadFlow?: LeadCaptureFlow | null },
  conversation: Conversation,
  flow: LeadCaptureFlow,
  state: FlowState,
  node: LeadFlowNode,
  sessionKey: string,
  conversationState: Map<string, { step: string; data: Record<string, string> }>,
  saveAndReturn: (businessId: string, conversationId: string, responses: BotResponse[]) => Promise<void>,
): Promise<BotResponse[]> {
  const vars = flowVars(business, ctx.customerName);
  const history = parseHistory(state.data.history);

  if (history.length === 0) {
    if (node.id === flow.startNodeId) {
      const text = renderTemplate(LEAD_FLOW_AT_START_MSG, vars);
      await saveAndReturn(business.id, conversation.id, [{ text }]);
      return [{ text }];
    }
    const start = findLeadFlowNode(flow, flow.startNodeId);
    if (!start) return [];
    conversationState.set(sessionKey, leadFlowState(start.id));
    return sendLeadFlowNode(business, conversation, start, vars, saveAndReturn);
  }

  const prevId = history[history.length - 1]!;
  const trimmed = history.slice(0, -1);
  const prev = findLeadFlowNode(flow, prevId);
  if (!prev) {
    conversationState.set(sessionKey, leadFlowState(flow.startNodeId));
    const start = findLeadFlowNode(flow, flow.startNodeId);
    if (!start) return [];
    return sendLeadFlowNode(business, conversation, start, vars, saveAndReturn);
  }

  conversationState.set(sessionKey, leadFlowState(prev.id, trimmed));
  return sendLeadFlowNode(business, conversation, prev, vars, saveAndReturn);
}

export async function handleLeadFlowMessage(
  ctx: BotContext,
  business: { id: string; name: string; leadFlow?: LeadCaptureFlow | null },
  conversation: Conversation,
  state: FlowState,
  sessionKey: string,
  conversationState: Map<string, { step: string; data: Record<string, string> }>,
  saveAndReturn: (businessId: string, conversationId: string, responses: BotResponse[]) => Promise<void>,
): Promise<BotResponse[]> {
  const flow = getLeadFlowConfig(business);
  if (!flow) {
    conversationState.delete(sessionKey);
    return [];
  }

  const nodeId = state.data.nodeId;
  const node = nodeId ? findLeadFlowNode(flow, nodeId) : null;
  if (!node) {
    conversationState.delete(sessionKey);
    return startLeadFlow(business, conversation, ctx.customerName, sessionKey, conversationState, saveAndReturn);
  }

  if (isLeadFlowBackCommand(ctx.messageBody)) {
    return handleLeadFlowBack(
      ctx,
      business,
      conversation,
      flow,
      state,
      node,
      sessionKey,
      conversationState,
      saveAndReturn,
    );
  }

  const picked = resolveLeadFlowButton(node, ctx.messageBody);
  if (!picked) {
    const invalid = node.invalidReply?.trim() || DEFAULT_LEAD_FLOW_INVALID_REPLY;
    const text = renderTemplate(invalid, flowVars(business, ctx.customerName));
    const vars = flowVars(business, ctx.customerName);
    const out: BotResponse[] = [{ text }];
    if (node.buttons.length) {
      out.push({
        text: renderTemplate(node.text, vars),
        buttons: node.buttons.map((b) => ({ id: b.id, label: b.label })),
      });
    }
    await saveAndReturn(business.id, conversation.id, out);
    return out;
  }

  if (!picked.nextNodeId) {
    conversationState.delete(sessionKey);
    return [];
  }

  const next = findLeadFlowNode(flow, picked.nextNodeId);
  if (!next) {
    conversationState.delete(sessionKey);
    return [];
  }

  const history = parseHistory(state.data.history);
  history.push(node.id);
  conversationState.set(sessionKey, leadFlowState(next.id, history));
  return sendLeadFlowNode(business, conversation, next, flowVars(business, ctx.customerName), saveAndReturn);
}

import {
  DEFAULT_LEAD_FLOW_IDLE_FOLLOW_UP_MESSAGE,
  DEFAULT_LEAD_FLOW_IDLE_FOLLOW_UP_MINUTES,
  DEFAULT_LEAD_FLOW_INVALID_REPLY,
  findLeadFlowButtonMatch,
  findLeadFlowNode,
  isLeadFlowBackCommand,
  isLeadFlowBackIntent,
  leadFlowTriggerMatch,
  matchesLeadFlowRestartTrigger,
  normalizeLeadCaptureFlow,
  renderTemplate,
  resolveLeadFlowButton,
  resolveLeadFlowEntryNode,
  type LeadCaptureFlow,
  type LeadFlowButton,
  type LeadFlowNode,
} from "@flowdesk/shared";
import type { Conversation } from "@flowdesk/firebase";
import {
  clearConversationBotFlowState,
  clearLeadFlowIdleFollowUp,
  newId,
  nowIso,
  scheduleLeadFlowIdleFollowUp,
  setConversationBotFlowState,
} from "@flowdesk/firebase";
import type { BotContext, BotResponse } from "./bot.js";

type FlowState = { step: "LEAD_FLOW"; data: Record<string, string> };
type FlowStateMap = Map<string, { step: string; data: Record<string, string> }>;

async function persistFlowState(
  businessId: string,
  conversationId: string,
  sessionKey: string,
  map: FlowStateMap,
  state: FlowState,
) {
  map.set(sessionKey, state);
  await setConversationBotFlowState(businessId, conversationId, state);
}

async function clearFlowState(
  businessId: string,
  conversationId: string,
  sessionKey: string,
  map: FlowStateMap,
) {
  map.delete(sessionKey);
  await clearConversationBotFlowState(businessId, conversationId).catch(() => undefined);
}

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
  const text = renderTemplate(node.text, vars).trim();
  const out: BotResponse[] = [];
  const hasButtons = node.buttons.length > 0;
  if (node.imageUrl) {
    const hint = `${node.imageUrl} ${node.imageStoragePath ?? ""}`.toLowerCase();
    const mediaType =
      node.mediaType ??
      (hint.includes(".gif") ? "gif" : hint.includes(".mp4") || hint.includes(".mov") ? "video" : "image");
    out.push({
      text,
      imageUrl: node.imageUrl,
      imageStoragePath: node.imageStoragePath,
      mediaType,
    });
  } else if (text && !hasButtons) {
    out.push({ text });
  }
  if (hasButtons) {
    out.push({
      text: node.imageUrl ? "👇 Toque em uma opção" : text || "👇 Escolha uma opção",
      buttons: node.buttons.map((b) => ({ id: b.id, label: b.label })),
    });
  }
  return out;
}

function leadFlowState(
  nodeId: string,
  history: string[] = [],
): { step: "LEAD_FLOW"; data: Record<string, string> } {
  return { step: "LEAD_FLOW", data: { nodeId, history: serializeHistory(history) } };
}

async function maybeScheduleIdleFollowUp(
  business: { id: string; name: string },
  conversation: Conversation,
  node: LeadFlowNode,
  customerName?: string
) {
  if (!node.idleFollowUpEnabled) return;
  const minutes = node.idleFollowUpMinutes ?? DEFAULT_LEAD_FLOW_IDLE_FOLLOW_UP_MINUTES;
  const template = node.idleFollowUpMessage?.trim() || DEFAULT_LEAD_FLOW_IDLE_FOLLOW_UP_MESSAGE;
  const vars = flowVars(business, customerName ?? conversation.customerName);
  const anchorAt = nowIso();
  const dueAt = new Date(Date.now() + minutes * 60_000).toISOString();
  await scheduleLeadFlowIdleFollowUp(business.id, {
    conversationId: conversation.id,
    customerPhone: conversation.customerPhone,
    replyJid: conversation.replyJid?.trim() || conversation.customerPhone,
    customerName: customerName ?? conversation.customerName,
    nodeId: node.id,
    visitId: newId(),
    dueAt,
    anchorAt,
    message: renderTemplate(template, vars),
  });
}

async function sendLeadFlowNode(
  business: { id: string; name: string },
  conversation: Conversation,
  node: LeadFlowNode,
  vars: Record<string, string>,
  saveAndReturn: (businessId: string, conversationId: string, responses: BotResponse[]) => Promise<void>,
  customerName?: string,
): Promise<BotResponse[]> {
  const out = leadFlowNodeToResponses(node, vars);
  if (!out.length) return [];
  await saveAndReturn(business.id, conversation.id, out);
  if (node.idleFollowUpEnabled) {
    await maybeScheduleIdleFollowUp(business, conversation, node, customerName);
  } else {
    await clearLeadFlowIdleFollowUp(business.id, conversation.id);
  }
  return out;
}

export async function recoverLeadFlowFromButton(
  ctx: BotContext,
  business: { id: string; leadFlow?: LeadCaptureFlow | null },
  conversation: Conversation,
  sessionKey: string,
  conversationState: FlowStateMap,
): Promise<boolean> {
  const flow = getLeadFlowConfig(business);
  if (!flow) return false;

  if (isLeadFlowBackCommand(ctx.messageBody)) {
    const persisted = conversation.botFlowState;
    if (persisted?.step === "LEAD_FLOW" && persisted.data?.nodeId) {
      await persistFlowState(business.id, conversation.id, sessionKey, conversationState, {
        step: "LEAD_FLOW",
        data: persisted.data,
      });
      return true;
    }
    const start = findLeadFlowNode(flow, flow.startNodeId);
    if (!start) return false;
    await persistFlowState(business.id, conversation.id, sessionKey, conversationState, leadFlowState(start.id));
    return true;
  }

  const match = findLeadFlowButtonMatch(flow, ctx.messageBody);
  if (!match) return false;
  if (isLeadFlowBackIntent(match.node, ctx.messageBody)) {
    const persisted = conversation.botFlowState;
    if (persisted?.step === "LEAD_FLOW" && persisted.data?.nodeId) {
      await persistFlowState(business.id, conversation.id, sessionKey, conversationState, {
        step: "LEAD_FLOW",
        data: persisted.data,
      });
      return true;
    }
    await persistFlowState(
      business.id,
      conversation.id,
      sessionKey,
      conversationState,
      leadFlowState(flow.startNodeId),
    );
    return true;
  }

  await persistFlowState(
    business.id,
    conversation.id,
    sessionKey,
    conversationState,
    leadFlowState(match.node.id),
  );
  return true;
}

export async function restartLeadFlowFromStart(
  business: {
    id: string;
    name: string;
    leadFlow?: LeadCaptureFlow | null;
    greetingEnabled?: boolean;
    greetingMsg?: string;
  },
  conversation: Conversation,
  customerName: string | undefined,
  sessionKey: string,
  conversationState: Map<string, { step: string; data: Record<string, string> }>,
  saveAndReturn: (businessId: string, conversationId: string, responses: BotResponse[]) => Promise<void>,
  opts: { sendGreeting?: boolean } = {},
): Promise<BotResponse[]> {
  const flow = getLeadFlowConfig(business);
  if (!flow) return [];
  await clearFlowState(business.id, conversation.id, sessionKey, conversationState);
  const start = findLeadFlowNode(flow, flow.startNodeId);
  if (!start) return [];

  const vars = flowVars(business, customerName);
  const out: BotResponse[] = [];
  const greetingOn = business.greetingEnabled !== false;
  if (opts.sendGreeting && greetingOn && business.greetingMsg?.trim()) {
    out.push({ text: renderTemplate(business.greetingMsg, vars) });
  }

  await persistFlowState(business.id, conversation.id, sessionKey, conversationState, leadFlowState(start.id));
  out.push(...leadFlowNodeToResponses(start, vars));
  if (!out.length) return [];
  await saveAndReturn(business.id, conversation.id, out);
  return out;
}

export { matchesLeadFlowRestartTrigger };

export async function startLeadFlow(
  business: { id: string; name: string; leadFlow?: LeadCaptureFlow | null },
  conversation: Conversation,
  customerName: string | undefined,
  sessionKey: string,
  conversationState: Map<string, { step: string; data: Record<string, string> }>,
  saveAndReturn: (businessId: string, conversationId: string, responses: BotResponse[]) => Promise<void>,
  messageBody = "",
): Promise<BotResponse[]> {
  const flow = getLeadFlowConfig(business);
  if (!flow) return [];
  const node = resolveLeadFlowEntryNode(flow, messageBody) ?? findLeadFlowNode(flow, flow.startNodeId);
  if (!node) return [];
  await persistFlowState(business.id, conversation.id, sessionKey, conversationState, leadFlowState(node.id));
  return sendLeadFlowNode(business, conversation, node, flowVars(business, customerName), saveAndReturn, customerName);
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
      const start = findLeadFlowNode(flow, flow.startNodeId);
      if (!start) return [];
      await persistFlowState(business.id, conversation.id, sessionKey, conversationState, leadFlowState(start.id));
      return sendLeadFlowNode(business, conversation, start, vars, saveAndReturn, ctx.customerName);
    }
    const start = findLeadFlowNode(flow, flow.startNodeId);
    if (!start) return [];
    await persistFlowState(business.id, conversation.id, sessionKey, conversationState, leadFlowState(start.id));
    return sendLeadFlowNode(business, conversation, start, vars, saveAndReturn, ctx.customerName);
  }

  const prevId = history[history.length - 1]!;
  const trimmed = history.slice(0, -1);
  const prev = findLeadFlowNode(flow, prevId);
  if (!prev) {
    await persistFlowState(
      business.id,
      conversation.id,
      sessionKey,
      conversationState,
      leadFlowState(flow.startNodeId),
    );
    const start = findLeadFlowNode(flow, flow.startNodeId);
    if (!start) return [];
    return sendLeadFlowNode(business, conversation, start, vars, saveAndReturn, ctx.customerName);
  }

  await persistFlowState(
    business.id,
    conversation.id,
    sessionKey,
    conversationState,
    leadFlowState(prev.id, trimmed),
  );
  return sendLeadFlowNode(business, conversation, prev, vars, saveAndReturn, ctx.customerName);
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
    await clearFlowState(business.id, conversation.id, sessionKey, conversationState);
    return [];
  }

  const nodeId = state.data.nodeId;
  const node = nodeId ? findLeadFlowNode(flow, nodeId) : null;
  if (!node) {
    await clearFlowState(business.id, conversation.id, sessionKey, conversationState);
    return startLeadFlow(
      business,
      conversation,
      ctx.customerName,
      sessionKey,
      conversationState,
      saveAndReturn,
      ctx.messageBody,
    );
  }

  const body = ctx.messageBody.trim().toLowerCase();
  for (const target of flow.nodes) {
    const keywords = target.entryKeywords ?? [];
    if (!keywords.some((kw) => body === kw || body.includes(kw))) continue;
    if (target.id === node.id) break;
    await persistFlowState(
      business.id,
      conversation.id,
      sessionKey,
      conversationState,
      leadFlowState(target.id),
    );
    return sendLeadFlowNode(business, conversation, target, flowVars(business, ctx.customerName), saveAndReturn, ctx.customerName);
  }

  if (isLeadFlowBackIntent(node, ctx.messageBody, flow)) {
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

  let activeNode = node;
  let picked: LeadFlowButton | null = resolveLeadFlowButton(node, ctx.messageBody);
  if (!picked) {
    const match = findLeadFlowButtonMatch(flow, ctx.messageBody);
    if (match) {
      if (isLeadFlowBackIntent(match.node, ctx.messageBody, flow)) {
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
      if (match.node.id !== node.id) {
        activeNode = match.node;
        await persistFlowState(
          business.id,
          conversation.id,
          sessionKey,
          conversationState,
          leadFlowState(match.node.id),
        );
        picked = match.button;
      }
    }
  }

  if (!picked) {
    const vars = flowVars(business, ctx.customerName);
    const invalid = node.invalidReply?.trim() || DEFAULT_LEAD_FLOW_INVALID_REPLY;
    const invalidText = renderTemplate(invalid, vars);
    const out: BotResponse[] = node.buttons.length
      ? [
          {
            text: invalidText,
            buttons: node.buttons.map((b) => ({ id: b.id, label: b.label })),
          },
        ]
      : [{ text: invalidText }];
    await saveAndReturn(business.id, conversation.id, out);
    return out;
  }

  if (!picked.nextNodeId) {
    await clearFlowState(business.id, conversation.id, sessionKey, conversationState);
    const text = renderTemplate("Obrigado! Em breve entraremos em contato. 😊", flowVars(business, ctx.customerName));
    await saveAndReturn(business.id, conversation.id, [{ text }]);
    return [{ text }];
  }

  const next = findLeadFlowNode(flow, picked.nextNodeId);
  if (!next) {
    await clearFlowState(business.id, conversation.id, sessionKey, conversationState);
    return [];
  }

  const history = parseHistory(state.data.history);
  history.push(activeNode.id);
  await persistFlowState(
    business.id,
    conversation.id,
    sessionKey,
    conversationState,
    leadFlowState(next.id, history),
  );
  return sendLeadFlowNode(business, conversation, next, flowVars(business, ctx.customerName), saveAndReturn, ctx.customerName);
}

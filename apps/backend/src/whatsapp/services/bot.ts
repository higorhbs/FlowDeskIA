/**
 * Motor de resposta automática do FlowDesk.
 * Recebe a mensagem, detecta intenção, busca dados do negócio e retorna resposta.
 */

import {
  getBusinessForBot,
  getTenant,
  listAppointments,
  upsertConversation,
  createMessage,
  createMessages,
  updateConversationStatus,
  createAppointment,
  createPayment,
  updatePayment,
  createOrder,
  listCustomerOrders,
  findConflictingAppointment,
  listCustomerAppointments,
  type Conversation,
  type OrderFulfillment,
  clearOutsideHoursNotice,
  tryClaimOutsideHoursNotice,
  setConversationBotFlowState,
  clearConversationBotFlowState,
  clearLeadFlowIdleFollowUp,
} from "@flowdesk/firebase";
import {
  APP_DISPLAY_NAME,
  detectIntent,
  isOpenNow,
  resolveAutoAwayMessage,
  getStoreAvailability,
  WorkingHours,
  DEFAULT_BUSINESS_TIMEZONE,
  formatCurrency,
  DAY_LABELS,
  renderTemplate,
  parseOptionNumber,
  isMenuRequest,
  isExitCommand,
  buildBotMenuEntries,
  findMatchingFaq,
  findLeadFlowEntryByKeyword,
  getBusinessVocabulary,
  businessRequiresBookingApproval,
  getBookingStatusLabel,
  getOrderStatusLabel,
  isChatGreeting,
  type BotMenuAction,
  PLAN_LIMITS,
  type LeadCaptureFlow,
  isWeeklyMenuTrigger,
  formatWeeklyMenuResponse,
  getTodayDayOfWeek,
  normalizeAppointmentBotConfig,
  normalizeOrderBotConfig,
  buildOrderMenuForDay,
  formatOrderMenuMessage,
  buildOrderMenuListSections,
  isOrderBotTrigger,
  isMyOrderStatusTrigger,
  isOrderCloseCommand,
  type OrderMenuEntry,
  type DayOfWeek,
} from "@flowdesk/shared";
import { createPixCharge } from "./pix.js";
import { printOrderReceipt } from "./printer.js";
import {
  isLeadFlowActive,
  startLeadFlow,
  handleLeadFlowMessage,
  leadFlowNodeToResponses,
  getLeadFlowConfig,
  recoverLeadFlowFromButton,
  restartLeadFlowFromStart,
  resendLeadFlowStartNode,
  matchesLeadFlowRestartTrigger,
} from "./lead-flow.js";
import {
  isResumeFlowActive,
  isResumeFlowFinalized,
  resumeArchivedFields,
  shouldStartResumeFlow,
  shouldEditResumeDocument,
  startResumeFlow,
  handleResumeFlowMessage,
  openResumeReview,
  getResumeFlowConfig,
} from "./resume-flow.js";
import { buildResumeEditKeywords, isResumeReviewEditReply } from "@flowdesk/shared";
import { addMinutes, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AsyncLocalStorage } from "node:async_hooks";

function voc(business: { type?: string }) {
  return getBusinessVocabulary(business.type);
}

function businessTimezone(business: { timezone?: string }) {
  return (typeof business.timezone === "string" && business.timezone.trim()) ||
    DEFAULT_BUSINESS_TIMEZONE;
}

function awayReply(
  business: {
    name: string;
    awayMsg?: string;
    lunchMsg?: string;
    workingHours?: Record<string, unknown>;
    timezone?: string;
    specialHours?: Record<string, [string, string] | null>;
    lunchBreak?: [string, string] | null;
  },
  customerName?: string
): string {
  const availability = getStoreAvailability(
    (business.workingHours ?? {}) as WorkingHours,
    businessTimezone(business),
    business.specialHours,
    business.lunchBreak ?? undefined
  );
  const raw =
    resolveAutoAwayMessage(availability, business.awayMsg, business.lunchMsg) ??
    business.awayMsg ??
    "Olá! No momento estamos fechados, mas logo retornamos. Deixe sua mensagem!";
  return renderTemplate(raw, { nome: customerName ?? "cliente", negocio: business.name });
}

export interface BotContext {
  businessId: string;
  customerPhone: string;
  customerName?: string;
  messageBody: string;
  replyJid?: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "audio" | "gif";
  persistReplies?: boolean;
}

export interface BotResponse {
  text: string;
  imageUrl?: string;
  imageStoragePath?: string;
  mediaType?: "image" | "video" | "gif";
  buttons?: { id: string; label: string }[];
  list?: {
    buttonText: string;
    sections: { title?: string; rows: { id: string; title: string; description?: string }[] }[];
  };
  documentBuffer?: Buffer;
  documentFilename?: string;
  documentMimetype?: string;
  documentLabel?: string;
  alsoSendDocumentTo?: string;
  sendDocumentToTeamOnly?: boolean;
  sendDocumentToSelf?: boolean;
}

// Estado de conversa por sessão (memória + Firestore para ORDER_*/LEAD/RESUME)
const conversationState = new Map<
  string,
  { step: string; data: Record<string, string> }
>();
const botPausedSessions = new Set<string>();
const closedNoticeClaims = new Map<string, Promise<boolean>>();
const replyPersistenceStore = new AsyncLocalStorage<{ defer: boolean }>();
let lastProcessMeta: { businessId: string; conversationId: string } | null = null;

const ORDER_FLOW_STEPS = new Set([
  "ORDER_ITEMS",
  "ORDER_FULFILLMENT",
  "ORDER_ADDRESS",
  "ORDER_PAYMENT",
]);
const ORDER_FLOW_TTL_MS = 3 * 60 * 60 * 1000;
const ORDER_FLOW_AT_KEY = "orderFlowAt";

function isOrderFlowStep(step?: string | null): boolean {
  return !!step && ORDER_FLOW_STEPS.has(step);
}

function isOrderFlowExpired(data?: Record<string, string> | null): boolean {
  const raw = data?.[ORDER_FLOW_AT_KEY];
  if (!raw) return false;
  const started = Date.parse(raw);
  if (Number.isNaN(started)) return true;
  return Date.now() - started > ORDER_FLOW_TTL_MS;
}

async function setOrderFlowState(
  businessId: string,
  conversationId: string,
  sessionKey: string,
  state: { step: string; data: Record<string, string> },
): Promise<void> {
  const prevAt = state.data[ORDER_FLOW_AT_KEY];
  const orderFlowAt =
    prevAt && !Number.isNaN(Date.parse(prevAt)) ? prevAt : new Date().toISOString();
  const next = { step: state.step, data: { ...state.data, [ORDER_FLOW_AT_KEY]: orderFlowAt } };
  conversationState.set(sessionKey, next);
  await setConversationBotFlowState(businessId, conversationId, next).catch(() => undefined);
}

async function clearOrderFlowState(
  businessId: string,
  conversationId: string,
  sessionKey: string,
): Promise<void> {
  conversationState.delete(sessionKey);
  await clearConversationBotFlowState(businessId, conversationId).catch(() => undefined);
}

async function expireOrderFlowIfNeeded(
  businessId: string,
  conversationId: string,
  sessionKey: string,
  state?: { step: string; data: Record<string, string> } | null,
): Promise<boolean> {
  if (!isOrderFlowStep(state?.step) || !isOrderFlowExpired(state?.data)) return false;
  await clearOrderFlowState(businessId, conversationId, sessionKey);
  return true;
}

function shouldDeferReplyPersistence() {
  return replyPersistenceStore.getStore()?.defer === true;
}

function mapBotResponsesToMessages(responses: BotResponse[]) {
  return responses.map((r) => ({
    role: "IA" as const,
    content:
      r.text.trim() ||
      (r.imageUrl ? (r.mediaType === "gif" ? "[gif]" : r.mediaType === "video" ? "[video]" : "[imagem]") : ""),
    ...(r.imageUrl
      ? {
          mediaUrl: r.imageUrl,
          mediaType:
            r.mediaType === "video" || r.mediaType === "gif" ? r.mediaType : ("image" as const),
        }
      : {}),
    ...(r.buttons?.length ? { buttons: r.buttons } : {}),
    ...(r.documentBuffer
      ? { content: r.text?.trim() || `[documento:${r.documentFilename ?? "arquivo.pdf"}]` }
      : {}),
  }));
}

export function takeLastProcessMeta() {
  const meta = lastProcessMeta;
  lastProcessMeta = null;
  return meta;
}

export async function persistBotReplies(
  businessId: string,
  conversationId: string,
  responses: BotResponse[],
): Promise<void> {
  if (!conversationId || !responses.length) return;
  await createMessages(businessId, conversationId, mapBotResponsesToMessages(responses));
}

async function claimClosedNotice(businessId: string, customerPhone: string): Promise<boolean> {
  const key = `${businessId}:${customerPhone}`;
  const pending = closedNoticeClaims.get(key);
  if (pending) return pending;

  const claim = tryClaimOutsideHoursNotice(businessId, customerPhone).finally(() => {
    if (closedNoticeClaims.get(key) === claim) closedNoticeClaims.delete(key);
  });
  closedNoticeClaims.set(key, claim);
  return claim;
}

async function replyWhenClosed(
  business: { id: string; name: string; awayMsg?: string; lunchMsg?: string; workingHours?: Record<string, unknown>; timezone?: string; specialHours?: Record<string, [string, string] | null>; lunchBreak?: [string, string] | null },
  conversation: Conversation,
  customerName: string | undefined,
  sessionKey: string
): Promise<BotResponse[]> {
  conversationState.delete(sessionKey);
  const claimed = await claimClosedNotice(business.id, conversation.customerPhone);
  if (!claimed) return [];
  const response = awayReply(business, customerName);
  await saveAndReturn(business.id, conversation.id, [{ text: response }]);
  return [{ text: response }];
}

function isRestaurantWeeklyMenuHit(
  business: { type?: string; weeklyMenu?: { enabled?: boolean; triggerKeywords?: string[] } },
  messageBody: string,
): boolean {
  if (business.type !== "RESTAURANT") return false;
  const weeklyMenu = business.weeklyMenu;
  if (!weeklyMenu?.enabled) return false;
  return isWeeklyMenuTrigger(messageBody, weeklyMenu as any);
}

function isRestaurantOrderBotHit(
  business: { type?: string; orderBot?: unknown },
  messageBody: string,
): boolean {
  if (business.type !== "RESTAURANT") return false;
  return isOrderBotTrigger(messageBody, normalizeOrderBotConfig(business.orderBot));
}

async function replyWeeklyMenu(
  business: any,
  conversation: Conversation,
  sessionKey: string,
): Promise<BotResponse[]> {
  conversationState.delete(sessionKey);
  botPausedSessions.delete(sessionKey);
  await clearConversationBotFlowState(business.id, conversation.id).catch(() => undefined);
  await clearLeadFlowIdleFollowUp(business.id, conversation.id).catch(() => undefined);
  const tz = businessTimezone(business);
  const dayOfWeek = getTodayDayOfWeek(tz);
  const text = formatWeeklyMenuResponse(business.weeklyMenu, dayOfWeek, business.name);
  await saveAndReturn(business.id, conversation.id, [{ text }]);
  return [{ text }];
}

async function tryProgrammedQuickReply(
  ctx: BotContext,
  business: { id: string; name: string; type?: string; faqs?: any[]; leadFlow?: LeadCaptureFlow | null; weeklyMenu?: any; orderBot?: unknown },
  conversation: Conversation,
  sessionKey: string,
  activeFlow?: { step: string } | null,
): Promise<BotResponse[] | null> {
  if (isResumeFlowActive(activeFlow) || isLeadFlowActive(activeFlow) || isOrderFlowStep(activeFlow?.step)) {
    return null;
  }

  if (
    isOrderCloseCommand(ctx.messageBody) &&
    business.type === "RESTAURANT" &&
    normalizeOrderBotConfig(business.orderBot).enabled
  ) {
    return null;
  }

  const faqHit = matchFaq(ctx.messageBody, business.faqs);
  if (faqHit) {
    conversationState.delete(sessionKey);
    const responses = [{ text: faqHit.answer }];
    await saveAndReturn(business.id, conversation.id, responses);
    return responses;
  }

  // Cardápio do restaurante tem prioridade sobre atalho de nó do lead flow.
  if (isRestaurantWeeklyMenuHit(business, ctx.messageBody)) return null;
  if (isRestaurantOrderBotHit(business, ctx.messageBody)) return null;

  const flow = getLeadFlowConfig(business);
  if (flow) {
    const node = findLeadFlowEntryByKeyword(flow, ctx.messageBody);
    if (node) {
      conversationState.delete(sessionKey);
      const vars = {
        nome: ctx.customerName ?? "cliente",
        negocio: business.name,
      };
      const responses = leadFlowNodeToResponses(node, vars);
      if (responses.length) {
        await saveAndReturn(business.id, conversation.id, responses);
        return responses;
      }
    }
  }

  return null;
}

export async function processMessage(ctx: BotContext): Promise<BotResponse[]> {
  return replyPersistenceStore.run({ defer: ctx.persistReplies === false }, () => processMessageInner(ctx));
}

async function processMessageInner(ctx: BotContext): Promise<BotResponse[]> {
  const { businessId, customerPhone, customerName, messageBody, replyJid, mediaUrl, mediaType } = ctx;
  const sessionKey = `${businessId}:${customerPhone}`;
  lastProcessMeta = null;

  // Busca negócio com relacionamentos necessários
  const business = await getBusinessForBot(businessId);

  if (!business) return [{ text: "Negócio não encontrado." }];

  const conversation = await upsertConversation(
    businessId,
    customerPhone,
    customerName,
    replyJid
  );
  lastProcessMeta = { businessId, conversationId: conversation.id };

  if (!conversationState.has(sessionKey) && conversation.botFlowState?.step === "LEAD_FLOW") {
    conversationState.set(sessionKey, conversation.botFlowState);
  }
  if (!conversationState.has(sessionKey) && conversation.botFlowState?.step === "RESUME_FLOW") {
    conversationState.set(sessionKey, conversation.botFlowState);
  }
  if (!conversationState.has(sessionKey) && isOrderFlowStep(conversation.botFlowState?.step)) {
    if (isOrderFlowExpired(conversation.botFlowState?.data)) {
      await clearConversationBotFlowState(businessId, conversation.id).catch(() => undefined);
      conversation.botFlowState = undefined;
    } else {
      conversationState.set(sessionKey, conversation.botFlowState!);
    }
  }

  let activeFlow = conversationState.get(sessionKey) ?? conversation.botFlowState;

  await createMessage(businessId, conversation.id, {
    role: "CUSTOMER",
    content: messageBody,
    ...(mediaUrl ? { mediaUrl, mediaType } : {}),
  });
  await clearLeadFlowIdleFollowUp(businessId, conversation.id).catch(() => undefined);

  if (business.botAutoReplyEnabled === false) return [];

  if (conversation.status === "ATTENDING" && !isExitCommand(messageBody))
    return [];

  if (isExitCommand(messageBody)) {
    return handleBotExit(business, conversation, sessionKey);
  }

  let state = conversationState.get(sessionKey);
  if (await expireOrderFlowIfNeeded(business.id, conversation.id, sessionKey, state)) {
    state = undefined;
    conversation.botFlowState = undefined;
    activeFlow = undefined;
    if (!isRestaurantOrderBotHit(business, messageBody) && !isMyOrderStatusTrigger(messageBody)) {
      const text =
        "Seu pedido expirou (máx. 3 horas). Digite *pedido* para começar de novo.";
      await saveAndReturn(business.id, conversation.id, [{ text }]);
      return [{ text }];
    }
  }
  if (state?.step !== "FAQ_SELECT") {
    const quick = await tryProgrammedQuickReply(ctx, business, conversation, sessionKey, activeFlow);
    if (quick) return quick;
  }

  const tz = businessTimezone(business);
  const open = isOpenNow(
    business.workingHours as WorkingHours,
    tz,
    business.specialHours,
    business.lunchBreak ?? undefined
  );

  if (open) {
    await clearOutsideHoursNotice(businessId, customerPhone);
  } else {
    return replyWhenClosed(business, conversation, customerName, sessionKey);
  }

  if (isRestaurantWeeklyMenuHit(business, messageBody)) {
    return replyWeeklyMenu(business, conversation, sessionKey);
  }

  if (isMyOrderStatusTrigger(messageBody) && business.type === "RESTAURANT" && normalizeOrderBotConfig(business.orderBot).enabled) {
    botPausedSessions.delete(sessionKey);
    return handleMyOrders(ctx, business, conversation);
  }

  // Fluxo de pedido ativo tem prioridade sobre gatilho "pedido" (ex: "fechar pedido").
  if (state?.step === "ORDER_ITEMS") {
    if (isExitCommand(messageBody)) {
      return handleBotExit(business, conversation, sessionKey);
    }
    if (isMenuRequest(messageBody)) {
      await clearOrderFlowState(business.id, conversation.id, sessionKey);
      const menu = buildMainMenu(business);
      await saveAndReturn(business.id, conversation.id, [{ text: menu }]);
      return [{ text: menu }];
    }
    return handleOrderItems(ctx, business, conversation, state, sessionKey);
  }
  if (state?.step === "ORDER_FULFILLMENT") {
    if (isMenuRequest(messageBody) || isExitCommand(messageBody)) {
      if (isExitCommand(messageBody)) return handleBotExit(business, conversation, sessionKey);
      await clearOrderFlowState(business.id, conversation.id, sessionKey);
      const menu = buildMainMenu(business);
      await saveAndReturn(business.id, conversation.id, [{ text: menu }]);
      return [{ text: menu }];
    }
    return handleOrderFulfillment(ctx, business, conversation, state, sessionKey);
  }
  if (state?.step === "ORDER_ADDRESS") {
    if (isMenuRequest(messageBody) || isExitCommand(messageBody)) {
      if (isExitCommand(messageBody)) return handleBotExit(business, conversation, sessionKey);
      await clearOrderFlowState(business.id, conversation.id, sessionKey);
      const menu = buildMainMenu(business);
      await saveAndReturn(business.id, conversation.id, [{ text: menu }]);
      return [{ text: menu }];
    }
    return handleOrderAddress(ctx, business, conversation, state, sessionKey);
  }
  if (state?.step === "ORDER_PAYMENT") {
    if (isExitCommand(messageBody)) {
      return handleBotExit(business, conversation, sessionKey);
    }
    return handleOrderPayment(ctx, business, conversation, state, sessionKey);
  }

  if (
    isOrderCloseCommand(messageBody) &&
    business.type === "RESTAURANT" &&
    normalizeOrderBotConfig(business.orderBot).enabled
  ) {
    const text =
      "Não há pedido em andamento. Digite *pedido* para começar e, ao terminar, *fechar pedido*.";
    await saveAndReturn(business.id, conversation.id, [{ text }]);
    return [{ text }];
  }

  if (isRestaurantOrderBotHit(business, messageBody)) {
    botPausedSessions.delete(sessionKey);
    await clearOrderFlowState(business.id, conversation.id, sessionKey);
    await clearLeadFlowIdleFollowUp(business.id, conversation.id).catch(() => undefined);
    return startOrderFlow(business, conversation, sessionKey, customerName);
  }

  if (botPausedSessions.has(sessionKey)) {
    botPausedSessions.delete(sessionKey);
    return sendPresentation(business, conversation, customerName);
  }

  if (isResumeFlowActive(activeFlow)) {
    if (isMenuRequest(messageBody) || isExitCommand(messageBody)) {
      conversationState.delete(sessionKey);
      if (isExitCommand(messageBody)) return handleBotExit(business, conversation, sessionKey);
      return sendPresentation(business, conversation, customerName);
    }
    const resumeState = activeFlow as { step: "RESUME_FLOW"; data: Record<string, string> };
    if (isResumeFlowFinalized(resumeState)) {
      const responses = await handleResumeFlowMessage(
        ctx,
        business,
        conversation,
        resumeState,
        sessionKey,
        conversationState,
        saveAndReturn,
      );
      if (responses.length) return responses;
      const cfg = getResumeFlowConfig(business);
      const editKeywords = buildResumeEditKeywords(cfg?.documentLabel);
      if (isResumeReviewEditReply(messageBody, editKeywords)) {
        return openResumeReview(
          business,
          conversation,
          customerName,
          sessionKey,
          conversationState,
          saveAndReturn,
          resumeState.data.fields ?? "{}",
        );
      }
      const archived = resumeState.data.fields;
      if (archived) {
        await setConversationBotFlowState(business.id, conversation.id, {
          step: "RESUME_ARCHIVE",
          data: { fields: archived },
        });
      } else {
        await clearConversationBotFlowState(business.id, conversation.id).catch(() => undefined);
      }
      conversationState.delete(sessionKey);
    } else {
      return handleResumeFlowMessage(
        ctx,
        business,
        conversation,
        resumeState,
        sessionKey,
        conversationState,
        saveAndReturn,
      );
    }
  }

  if (shouldStartResumeFlow(business, messageBody)) {
    conversationState.delete(sessionKey);
    await clearConversationBotFlowState(business.id, conversation.id).catch(() => undefined);
    await clearLeadFlowIdleFollowUp(business.id, conversation.id).catch(() => undefined);
    return startResumeFlow(
      business,
      conversation,
      customerName,
      sessionKey,
      conversationState,
      saveAndReturn,
    );
  }

  const flowConfig = getLeadFlowConfig(business);
  const greetingHit = isChatGreeting(messageBody);
  if (
    flowConfig &&
    matchesLeadFlowRestartTrigger(flowConfig, messageBody, greetingHit)
  ) {
    if (greetingHit) {
      const active = conversationState.get(sessionKey) ?? conversation.botFlowState;
      if (isLeadFlowActive(active)) {
        const nodeId = String(active?.data?.nodeId ?? "");
        if (!nodeId || nodeId === flowConfig.startNodeId) {
          return resendLeadFlowStartNode(business, conversation, customerName, saveAndReturn);
        }
      }
    }
    conversationState.delete(sessionKey);
    return restartLeadFlowFromStart(
      business,
      conversation,
      customerName,
      sessionKey,
      conversationState,
      saveAndReturn,
      { sendGreeting: flowConfig.startOnGreeting && greetingHit },
    );
  }

  if (!isLeadFlowActive(activeFlow) && !isResumeFlowActive(activeFlow)) {
    const recovered = await recoverLeadFlowFromButton(
      ctx,
      business,
      conversation,
      sessionKey,
      conversationState,
    );
    if (recovered) {
      const leadOut = await handleLeadFlowMessage(
        ctx,
        business,
        conversation,
        conversationState.get(sessionKey) as { step: "LEAD_FLOW"; data: Record<string, string> },
        sessionKey,
        conversationState,
        saveAndReturn,
      );
      if (leadOut.length) return leadOut;
    }
  }

  if (isLeadFlowActive(activeFlow)) {
    if (isMenuRequest(messageBody) || isExitCommand(messageBody)) {
      conversationState.delete(sessionKey);
      if (isExitCommand(messageBody)) return handleBotExit(business, conversation, sessionKey);
      return sendPresentation(business, conversation, customerName);
    }
    const leadOut = await handleLeadFlowMessage(
      ctx,
      business,
      conversation,
      activeFlow as { step: "LEAD_FLOW"; data: Record<string, string> },
      sessionKey,
      conversationState,
      saveAndReturn,
    );
    if (leadOut.length) return leadOut;
  }

  if (
    shouldEditResumeDocument(business, messageBody, conversation.botFlowState ?? activeFlow)
  ) {
    const fields = resumeArchivedFields(conversation.botFlowState ?? state);
    if (!fields) return [];
    if (!conversationState.has(sessionKey) && conversation.botFlowState) {
      conversationState.set(sessionKey, conversation.botFlowState);
    }
    return openResumeReview(
      business,
      conversation,
      customerName,
      sessionKey,
      conversationState,
      saveAndReturn,
      fields,
    );
  }

  const intent = detectIntent(messageBody, business.type);

  // ─── Fluxo de agendamento (multi-step) ────────────────────────────────────
  if (state?.step === "APPOINTMENT_DATE") {
    if (isMenuRequest(messageBody) || isExitCommand(messageBody)) {
      conversationState.delete(sessionKey);
      if (isExitCommand(messageBody)) return handleBotExit(business, conversation, sessionKey);
      const menu = buildMainMenu(business);
      await saveAndReturn(business.id, conversation.id, [{ text: menu }]);
      return [{ text: menu }];
    }
    return handleAppointmentDate(ctx, business, conversation, state, sessionKey);
  }
  if (state?.step === "APPOINTMENT_TIME") {
    if (isMenuRequest(messageBody) || isExitCommand(messageBody)) {
      conversationState.delete(sessionKey);
      if (isExitCommand(messageBody)) return handleBotExit(business, conversation, sessionKey);
      const menu = buildMainMenu(business);
      await saveAndReturn(business.id, conversation.id, [{ text: menu }]);
      return [{ text: menu }];
    }
    return handleAppointmentTime(ctx, business, conversation, state, sessionKey);
  }
  if (state?.step === "PAYMENT_AMOUNT") {
    if (isMenuRequest(messageBody) || isExitCommand(messageBody)) {
      conversationState.delete(sessionKey);
      if (isExitCommand(messageBody)) return handleBotExit(business, conversation, sessionKey);
      const menu = buildMainMenu(business);
      await saveAndReturn(business.id, conversation.id, [{ text: menu }]);
      return [{ text: menu }];
    }
    return handlePaymentAmount(ctx, business, conversation, state, sessionKey);
  }
  if (state?.step === "FAQ_SELECT") {
    return handleFAQSelect(ctx, business, conversation, sessionKey);
  }

  if (isMenuRequest(messageBody)) {
    if (!isBotMenuEnabled(business)) {
      const pres = await sendPresentation(business, conversation, customerName);
      if (pres.length) return pres;
      return [];
    }
    const menu = buildMainMenu(business);
    await saveAndReturn(business.id, conversation.id, [{ text: menu }]);
    return [{ text: menu }];
  }

  const menuPick = isBotMenuEnabled(business) ? resolveMenuSelection(messageBody, business) : null;
  if (menuPick === "EXIT") {
    return handleBotExit(business, conversation, sessionKey);
  }
  if (menuPick) {
    return handleMenuItemSelection(
      menuPick,
      ctx,
      business,
      conversation,
      sessionKey,
    );
  }

  if (!state && business.type !== "RESTAURANT" && looksLikeAppointmentDate(messageBody)) {
    const apptState = { step: "APPOINTMENT_DATE", data: { serviceName: voc(business).botBookingServiceDefault } };
    conversationState.set(sessionKey, apptState);
    return handleAppointmentDate(ctx, business, conversation, apptState, sessionKey);
  }

  if (isThanks(messageBody)) {
    const text = thanksReply(business, customerName);
    await saveAndReturn(business.id, conversation.id, [{ text }]);
    return [{ text }];
  }

  // ─── Respostas por intenção ────────────────────────────────────────────────
  switch (intent) {
    case "CATALOG":
      return handleCatalog(business, conversation);

    case "MY_APPOINTMENT":
      if (business.type === "RESTAURANT" && normalizeOrderBotConfig(business.orderBot).enabled) {
        return handleMyOrders(ctx, business, conversation);
      }
      return handleMyAppointments(ctx, business, conversation);

    case "APPOINTMENT":
      if (business.type === "RESTAURANT" && normalizeOrderBotConfig(business.orderBot).enabled) {
        return startOrderFlow(business, conversation, sessionKey, ctx.customerName);
      }
      return startAppointmentFlow(business, conversation, sessionKey, ctx.customerName);

    case "QUOTE":
      return handleQuote(business, conversation);

    case "PAYMENT":
      return startPaymentFlow(ctx, business, conversation, sessionKey);

    case "FAQ":
      return handleFAQ(messageBody, business, conversation, sessionKey);

    case "HUMAN":
      await updateConversationStatus(businessId, conversation.id, "ATTENDING");
      return saveHumanHandoff(businessId, conversation.id);

    default: {
      if (!isBotMenuEnabled(business) && !state) {
        return [];
      }
      const fallback = buildFallbackMessage(business);
      await saveAndReturn(business.id, conversation.id, [{ text: fallback }]);
      return [{ text: fallback }];
    }
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleCatalog(business: any, conversation: Conversation): Promise<BotResponse[]> {
  if (business.type === "RESTAURANT" && business.weeklyMenu?.enabled) {
    const tz = businessTimezone(business);
    const dayOfWeek = getTodayDayOfWeek(tz);
    const text = formatWeeklyMenuResponse(business.weeklyMenu, dayOfWeek, business.name);
    await saveAndReturn(business.id, conversation.id, [{ text }]);
    return [{ text }];
  }

  const v = voc(business);
  if (!business.catalog.length) {
    const text = v.botCatalogEmpty;
    await saveAndReturn(business.id, conversation.id, [{ text }]);
    return [{ text }];
  }

  let text = `📋 *${v.botCatalogHeader} — ${business.name}*\n\n`;
  for (const item of business.catalog) {
    text += `• *${item.name}*`;
    if (item.description) text += ` — ${item.description}`;
    text += ` — *${formatCurrency(item.price)}*\n`;
  }
  text += v.botCatalogFooter;

  await saveAndReturn(business.id, conversation.id, [{ text }]);
  return [{ text }];
}

async function startAppointmentFlow(
  business: any,
  conversation: Conversation,
  sessionKey: string,
  customerName?: string,
): Promise<BotResponse[]> {
  const v = voc(business);
  conversationState.set(sessionKey, {
    step: "APPOINTMENT_DATE",
    data: { serviceName: v.botBookingServiceDefault },
  });
  const cfg = normalizeAppointmentBotConfig(business.appointmentBot);
  const text = renderTemplate(cfg.startMessage, {
    nome: customerName ?? "cliente",
    negocio: business.name,
  }).trim();
  await saveAndReturn(business.id, conversation.id, [{ text }]);
  return [{ text }];
}

async function handleAppointmentDate(
  ctx: BotContext,
  business: any,
  conversation: Conversation,
  state: any,
  sessionKey: string,
): Promise<BotResponse[]> {
  const dateStr = ctx.messageBody.trim();
  // Parse simples: dd/MM
  const match = dateStr.match(/(\d{1,2})\/(\d{1,2})/);
  let date: Date | null = null;

  if (match) {
    const [, d, m] = match;
    const year = new Date().getFullYear();
    date = new Date(year, parseInt(m) - 1, parseInt(d));
  } else if (dateStr.toLowerCase().includes("amanhã")) {
    date = new Date();
    date.setDate(date.getDate() + 1);
  }

  if (!date || isNaN(date.getTime())) {
    const text =
      "Não entendi a data. Por favor, informe no formato *dd/mm* (ex: *15/06*)";
    await saveAndReturn(business.id, conversation.id, [{ text }]);
    return [{ text }];
  }

  state.data.date = date.toISOString();
  conversationState.set(sessionKey, {
    step: "APPOINTMENT_TIME",
    data: state.data,
  });

  const text = `Data *${format(date, "dd/MM/yyyy", { locale: ptBR })}* selecionada!\n\nQual horário prefere? (ex: *10:00* ou *14:30*)`;
  await saveAndReturn(business.id, conversation.id, [{ text }]);
  return [{ text }];
}

async function handleAppointmentTime(
  ctx: BotContext,
  business: any,
  conversation: Conversation,
  state: any,
  sessionKey: string,
): Promise<BotResponse[]> {
  const timeStr = ctx.messageBody.trim();
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);

  if (!match) {
    const text =
      "Por favor, informe o horário no formato *HH:MM* (ex: *10:00*)";
    await saveAndReturn(business.id, conversation.id, [{ text }]);
    return [{ text }];
  }

  const [, h, min] = match;
  const baseDate = new Date(state.data.date);
  baseDate.setHours(parseInt(h), parseInt(min), 0, 0);

  const durationMins = 60;
  const bufferMins = Math.max(0, business.appointmentBufferMins ?? 0);
  const conflict = await findConflictingAppointment(
    business.id,
    baseDate.toISOString(),
    durationMins,
    bufferMins,
  );
  if (conflict) {
    const conflictAt = new Date(conflict.scheduledAt);
    const freeFrom = new Date(
      conflictAt.getTime() + (conflict.durationMins ?? 60) * 60_000 + bufferMins * 60_000,
    );
    const bufferLine =
      bufferMins > 0
        ? `\nMantemos *${bufferMins} min* de intervalo entre atendimentos.`
        : "";
    const text =
      `⚠️ *Horário indisponível*\n\n` +
      `Já existe um agendamento em *${format(baseDate, "dd/MM/yyyy", { locale: ptBR })}* às *${format(conflictAt, "HH:mm")}*.${bufferLine}\n\n` +
      `A partir de *${format(freeFrom, "HH:mm")}* já libera. Envie outro horário ou outra data.`;
    await saveAndReturn(business.id, conversation.id, [{ text }]);
    return [{ text }];
  }

  const tenant = await getTenant(business.tenantId);
  const plan = tenant?.plan ?? "STARTER";
  const monthlyLimit = PLAN_LIMITS[plan].appointmentsPerMonth;
  if (Number.isFinite(monthlyLimit)) {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const to = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    ).toISOString();
    const monthAppointments = await listAppointments(business.id, { from, to });
    if (monthAppointments.length >= monthlyLimit) {
      const text =
        `Limite de agendamentos do plano *${plan}* atingido neste mês (${monthlyLimit}).\n` +
        `Faça upgrade para continuar recebendo agendamentos automáticos.`;
      await saveAndReturn(business.id, conversation.id, [{ text }]);
      return [{ text }];
    }
  }

  const v = voc(business);
  const needsApproval = businessRequiresBookingApproval(business.type, business.appointmentBot);
  const appointment = await createAppointment({
    businessId: business.id,
    conversationId: conversation.id,
    customerPhone: ctx.customerPhone,
    customerName: ctx.customerName,
    serviceName: state.data.serviceName || v.botBookingServiceDefault,
    scheduledAt: baseDate.toISOString(),
    durationMins,
    status: needsApproval ? "PENDING" : "CONFIRMED",
  });

  conversationState.delete(sessionKey);

  const cfg = normalizeAppointmentBotConfig(business.appointmentBot);
  const text = renderTemplate(
    needsApproval ? cfg.awaitingMessage : cfg.completedMessage,
    {
      nome: ctx.customerName ?? "cliente",
      negocio: business.name,
      data: format(baseDate, "dd/MM/yyyy", { locale: ptBR }),
      hora: format(baseDate, "HH:mm"),
      codigo: appointment.id.slice(0, 8),
    },
  ).trim();

  await saveAndReturn(business.id, conversation.id, [{ text }]);
  return [{ text }];
}

async function handleMyAppointments(
  ctx: BotContext,
  business: any,
  conversation: Conversation,
): Promise<BotResponse[]> {
  const v = voc(business);
  const upcoming = await listCustomerAppointments(business.id, ctx.customerPhone, {
    upcomingOnly: true,
  });

  if (!upcoming.length) {
    const past = await listCustomerAppointments(business.id, ctx.customerPhone);
    if (!past.length) {
      const text =
        `📅 Você ainda não tem ${v.bookingSingular.toLowerCase()} em *${business.name}*.\n\n` +
        `Para solicitar, use o *menu* ou digite *${v.botAppointmentKeywords[0] ?? "agendar"}*.`;
      await saveAndReturn(business.id, conversation.id, [{ text }]);
      return [{ text }];
    }
    const last = past[past.length - 1]!;
    const when = new Date(last.scheduledAt);
    const text =
      `📅 *Seu último ${v.bookingSingular.toLowerCase()}*\n\n` +
      `Item: *${last.serviceName}*\n` +
      `Data: *${format(when, "dd/MM/yyyy", { locale: ptBR })}*\n` +
      `Horário: *${format(when, "HH:mm")}*\n` +
      `Status: *${getBookingStatusLabel(business.type, last.status)}*\n` +
      `Código: *${last.id.slice(0, 8)}*\n\n` +
      `Não há ${v.bookingsPlural.toLowerCase()} futuros. Para novo, digite *${v.botAppointmentKeywords[0] ?? "agendar"}*.`;
    await saveAndReturn(business.id, conversation.id, [{ text }]);
    return [{ text }];
  }

  const lines = upcoming.map((apt, i) => {
    const when = new Date(apt.scheduledAt);
    return (
      `*${i + 1}.* ${apt.serviceName}\n` +
      `   📅 ${format(when, "dd/MM/yyyy", { locale: ptBR })} às ${format(when, "HH:mm")}\n` +
      `   🔖 ${apt.id.slice(0, 8)} · ${getBookingStatusLabel(business.type, apt.status)}`
    );
  });

  const text =
    `📅 *Seus ${v.bookingsPlural.toLowerCase()} — ${business.name}*\n\n` +
    lines.join("\n\n") +
    `\n\nPara solicitar outro, digite *${v.botAppointmentKeywords[0] ?? "agendar"}*.`;
  await saveAndReturn(business.id, conversation.id, [{ text }]);
  return [{ text }];
}

// ─── Fluxo de pedido guiado (restaurantes) ─────────────────────────────────────

type OrderCartLine = { num: number; name: string; price?: number; category?: string; quantity: number };

function parseOrderItemTokens(text: string): { num: number; qty: number }[] {
  const tokens = text.split(",").map((t) => t.trim()).filter(Boolean);
  const parsed: { num: number; qty: number }[] = [];
  for (const token of tokens) {
    const match = token.match(/^(\d{1,3})\s*(?:x\s*(\d{1,2}))?$/i);
    if (!match) continue;
    const num = parseInt(match[1]!, 10);
    const qty = match[2] ? parseInt(match[2], 10) : 1;
    if (num > 0 && qty > 0) parsed.push({ num, qty });
  }
  return parsed;
}

function buildCombinedOrderEntries(business: any, dayOfWeek: DayOfWeek): OrderMenuEntry[] {
  const weeklyMenu = business.weeklyMenu;
  const menuEntries: OrderMenuEntry[] = weeklyMenu ? buildOrderMenuForDay(weeklyMenu, dayOfWeek) : [];

  const catalogItems: any[] = Array.isArray(business.catalog) ? business.catalog : [];
  const catalogEntries: OrderMenuEntry[] = catalogItems
    .filter((item) => item.available !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((item, i) => ({
      num: menuEntries.length + i + 1,
      item: {
        id: item.id,
        name: item.name,
        price: item.price,
        category: "Produtos",
      },
    }));

  return [...menuEntries, ...catalogEntries];
}

async function startOrderFlow(
  business: any,
  conversation: Conversation,
  sessionKey: string,
  customerName?: string,
): Promise<BotResponse[]> {
  const cfg = normalizeOrderBotConfig(business.orderBot);
  const tz = businessTimezone(business);
  const dayOfWeek = getTodayDayOfWeek(tz);
  const entries: OrderMenuEntry[] = buildCombinedOrderEntries(business, dayOfWeek);

  if (!entries.length) {
    const text = "Ainda não temos itens cadastrados para pedido. Fale com a gente que te ajudamos!";
    await saveAndReturn(business.id, conversation.id, [{ text }]);
    return [{ text }];
  }

  await setOrderFlowState(business.id, conversation.id, sessionKey, {
    step: "ORDER_ITEMS",
    data: { menuJson: JSON.stringify(entries), itemsJson: "[]" },
  });

  const intro = renderTemplate(cfg.startMessage, {
    nome: customerName ?? "cliente",
    negocio: business.name,
  }).trim();
  const menuText = formatOrderMenuMessage(entries, business.name, dayOfWeek);
  const text = `${intro}\n\n${menuText}`;
  const sections = buildOrderMenuListSections(entries);
  const list = sections.length ? { buttonText: "Ver cardápio", sections } : undefined;
  await saveAndReturn(business.id, conversation.id, [{ text, list }]);
  return [{ text, list }];
}

async function handleOrderItems(
  ctx: BotContext,
  business: any,
  conversation: Conversation,
  state: any,
  sessionKey: string,
): Promise<BotResponse[]> {
  const raw = ctx.messageBody.trim();
  const lower = raw.toLowerCase();
  const cfg = normalizeOrderBotConfig(business.orderBot);
  const cart: OrderCartLine[] = JSON.parse(state.data.itemsJson || "[]");

  if (isOrderCloseCommand(lower)) {
    if (!cart.length) {
      const text = "Seu carrinho está vazio. Digite o número de um prato para adicionar antes de fechar o pedido.";
      await saveAndReturn(business.id, conversation.id, [{ text }]);
      return [{ text }];
    }
    return advanceAfterOrderItems(business, conversation, sessionKey, state.data, cart, cfg);
  }

  const entries: OrderMenuEntry[] = JSON.parse(state.data.menuJson || "[]");
  const tokens = parseOrderItemTokens(raw);
  if (!tokens.length) {
    const text =
      "Não entendi. Digite o número do prato (ex: *2* ou *2x3* para 3 unidades), ou *fechar pedido* para continuar.";
    await saveAndReturn(business.id, conversation.id, [{ text }]);
    return [{ text }];
  }

  let addedAny = false;
  for (const { num, qty } of tokens) {
    const entry = entries.find((e) => e.num === num);
    if (!entry) continue;
    addedAny = true;
    const existing = cart.find((c) => c.num === num);
    if (existing) existing.quantity += qty;
    else {
      cart.push({
        num,
        name: entry.item.name,
        price: entry.item.price,
        category: entry.item.category,
        quantity: qty,
      });
    }
  }

  if (!addedAny) {
    const text = "Não encontrei esse número no cardápio. Confira a lista e tente de novo.";
    await saveAndReturn(business.id, conversation.id, [{ text }]);
    return [{ text }];
  }

  await setOrderFlowState(business.id, conversation.id, sessionKey, {
    step: "ORDER_ITEMS",
    data: { ...state.data, itemsJson: JSON.stringify(cart) },
  });

  const total = cart.reduce((sum, i) => sum + (i.price ?? 0) * i.quantity, 0);
  const lines = cart.map(
    (i) => `• ${i.quantity}x ${i.name}${i.price ? ` — ${formatCurrency(i.price * i.quantity)}` : ""}`,
  );
  const footer = cfg.askAddMoreItems ? `\n\n${cfg.cartFooterMessage}` : "";
  const text =
    `🛒 *Seu pedido até agora:*\n${lines.join("\n")}\n\n` +
    `💰 Total parcial: *${formatCurrency(total)}*` + footer;
  await saveAndReturn(business.id, conversation.id, [{ text }]);
  return [{ text }];
}

async function promptOrderPayment(
  business: any,
  conversation: Conversation,
  sessionKey: string,
  data: Record<string, string>,
  cfg: ReturnType<typeof normalizeOrderBotConfig>,
): Promise<BotResponse[]> {
  await setOrderFlowState(business.id, conversation.id, sessionKey, { step: "ORDER_PAYMENT", data });
  const lines = cfg.paymentMethods.map((m, i) => `*${i + 1}* — ${m}`);
  const text = `Como você vai pagar?\n\n${lines.join("\n")}`;
  await saveAndReturn(business.id, conversation.id, [{ text }]);
  return [{ text }];
}

async function advanceAfterOrderItems(
  business: any,
  conversation: Conversation,
  sessionKey: string,
  data: Record<string, string>,
  cart: OrderCartLine[],
  cfg: ReturnType<typeof normalizeOrderBotConfig>,
): Promise<BotResponse[]> {
  const dataBase = { ...data, itemsJson: JSON.stringify(cart) };
  if (cfg.fulfillmentDelivery && cfg.fulfillmentPickup) {
    await setOrderFlowState(business.id, conversation.id, sessionKey, {
      step: "ORDER_FULFILLMENT",
      data: dataBase,
    });
    const text = "Como prefere receber?\n\n*1* — Entrega\n*2* — Retirada no local";
    await saveAndReturn(business.id, conversation.id, [{ text }]);
    return [{ text }];
  }
  const fulfillment: OrderFulfillment = cfg.fulfillmentDelivery ? "DELIVERY" : "PICKUP";
  if (fulfillment === "DELIVERY") {
    await setOrderFlowState(business.id, conversation.id, sessionKey, {
      step: "ORDER_ADDRESS",
      data: { ...dataBase, fulfillment },
    });
    const text = "Qual o endereço de entrega? (rua, número, bairro)";
    await saveAndReturn(business.id, conversation.id, [{ text }]);
    return [{ text }];
  }
  return promptOrderPayment(business, conversation, sessionKey, { ...dataBase, fulfillment }, cfg);
}

async function handleOrderFulfillment(
  ctx: BotContext,
  business: any,
  conversation: Conversation,
  state: any,
  sessionKey: string,
): Promise<BotResponse[]> {
  const raw = ctx.messageBody.trim().toLowerCase();
  const cfg = normalizeOrderBotConfig(business.orderBot);
  const isDelivery = raw === "1" || raw.includes("entrega");
  const isPickup = raw === "2" || raw.includes("retirada") || raw.includes("retirar");

  if (!isDelivery && !isPickup) {
    const text = "Não entendi. Digite *1* para Entrega ou *2* para Retirada.";
    await saveAndReturn(business.id, conversation.id, [{ text }]);
    return [{ text }];
  }

  const fulfillment: OrderFulfillment = isDelivery ? "DELIVERY" : "PICKUP";
  if (fulfillment === "DELIVERY") {
    await setOrderFlowState(business.id, conversation.id, sessionKey, {
      step: "ORDER_ADDRESS",
      data: { ...state.data, fulfillment },
    });
    const text = "Qual o endereço de entrega? (rua, número, bairro)";
    await saveAndReturn(business.id, conversation.id, [{ text }]);
    return [{ text }];
  }
  return promptOrderPayment(business, conversation, sessionKey, { ...state.data, fulfillment }, cfg);
}

async function handleOrderAddress(
  ctx: BotContext,
  business: any,
  conversation: Conversation,
  state: any,
  sessionKey: string,
): Promise<BotResponse[]> {
  const address = ctx.messageBody.trim();
  if (address.length < 5) {
    const text = "Endereço muito curto. Envie o endereço completo (rua, número, bairro).";
    await saveAndReturn(business.id, conversation.id, [{ text }]);
    return [{ text }];
  }
  const cfg = normalizeOrderBotConfig(business.orderBot);
  return promptOrderPayment(business, conversation, sessionKey, { ...state.data, address }, cfg);
}

async function handleOrderPayment(
  ctx: BotContext,
  business: any,
  conversation: Conversation,
  state: any,
  sessionKey: string,
): Promise<BotResponse[]> {
  const cfg = normalizeOrderBotConfig(business.orderBot);
  const raw = ctx.messageBody.trim();
  const n = parseOptionNumber(raw, 1, cfg.paymentMethods.length);
  const paymentMethod = n
    ? cfg.paymentMethods[n - 1]
    : cfg.paymentMethods.find((m) => raw.toLowerCase().includes(m.toLowerCase()));

  if (!paymentMethod) {
    const lines = cfg.paymentMethods.map((m, i) => `*${i + 1}* — ${m}`);
    const text = `Não entendi a forma de pagamento. Escolha uma opção:\n\n${lines.join("\n")}`;
    await saveAndReturn(business.id, conversation.id, [{ text }]);
    return [{ text }];
  }

  const cart: OrderCartLine[] = JSON.parse(state.data.itemsJson || "[]");
  const total = cart.reduce((sum, i) => sum + (i.price ?? 0) * i.quantity, 0);
  const fulfillment: OrderFulfillment = (state.data.fulfillment as OrderFulfillment) ?? "PICKUP";
  const needsApproval = cfg.requiresApproval;

  const order = await createOrder({
    businessId: business.id,
    conversationId: conversation.id,
    customerPhone: ctx.customerPhone,
    customerName: ctx.customerName,
    items: cart.map((c) => ({ name: c.name, quantity: c.quantity, price: c.price, category: c.category })),
    total,
    fulfillment,
    deliveryAddress: state.data.address,
    paymentMethod,
    status: needsApproval ? "PENDING" : "CONFIRMED",
  });

  printOrderReceipt(business, order)
    .then((result) => {
      if (!result.ok) console.error(`[printer] Falha ao imprimir pedido ${order.id}: ${result.error}`);
    })
    .catch((err) => console.error(`[printer] Erro inesperado ao imprimir pedido ${order.id}:`, err));

  await clearOrderFlowState(business.id, conversation.id, sessionKey);

  const itensText = cart.map((i) => `• ${i.quantity}x ${i.name}`).join("\n");
  const text = renderTemplate(needsApproval ? cfg.awaitingMessage : cfg.completedMessage, {
    nome: ctx.customerName ?? "cliente",
    negocio: business.name,
    itens: itensText,
    total: formatCurrency(total),
    entrega: fulfillment === "DELIVERY" ? "Entrega" : "Retirada no local",
    pagamento: paymentMethod,
    codigo: order.id.slice(0, 8),
  }).trim();

  await saveAndReturn(business.id, conversation.id, [{ text }]);
  return [{ text }];
}

async function handleMyOrders(
  ctx: BotContext,
  business: any,
  conversation: Conversation,
): Promise<BotResponse[]> {
  const orders = await listCustomerOrders(business.id, ctx.customerPhone);
  if (!orders.length) {
    const text = `📋 Você ainda não tem pedidos em *${business.name}*.\n\nPara pedir, digite *pedido* ou *cardápio*.`;
    await saveAndReturn(business.id, conversation.id, [{ text }]);
    return [{ text }];
  }
  const last = orders[0]!;
  const lines = last.items.map((i) => `• ${i.quantity}x ${i.name}`).join("\n");
  const text =
    `📋 *Seu último pedido — ${business.name}*\n\n${lines}\n\n` +
    `💰 Total: *${formatCurrency(last.total ?? 0)}*\n` +
    `Status: *${getOrderStatusLabel(last.status, last.fulfillment)}*\n` +
    `Código: *${last.id.slice(0, 8)}*\n\n` +
    `Para um novo pedido, digite *pedido*.`;
  await saveAndReturn(business.id, conversation.id, [{ text }]);
  return [{ text }];
}

function tenantAllowsPix(plan?: string): boolean {
  return plan === "PRO" || plan === "UNLIMITED";
}

async function pixGate(
  business: { id: string; tenantId: string; mercadoPagoConfigured?: boolean },
  conversation: Conversation
): Promise<BotResponse[] | null> {
  if (!business.mercadoPagoConfigured) {
    const text =
      `💳 Pagamento PIX ainda não está ativo neste negócio. O dono precisa salvar o Access Token do Mercado Pago em *Pagamentos* no painel ${APP_DISPLAY_NAME}.`;
    await saveAndReturn(business.id, conversation.id, [{ text }]);
    return [{ text }];
  }
  const tenant = await getTenant(business.tenantId);
  if (!tenantAllowsPix(tenant?.plan)) {
    const text =
      `💳 Cobrança PIX automática está disponível no plano *Pro* do ${APP_DISPLAY_NAME}. O estabelecimento pode ativar em *Meu plano*.`;
    await saveAndReturn(business.id, conversation.id, [{ text }]);
    return [{ text }];
  }
  return null;
}

async function startPaymentFlow(
  ctx: BotContext,
  business: { id: string; tenantId: string },
  conversation: Conversation,
  sessionKey: string
): Promise<BotResponse[]> {
  const blocked = await pixGate(business, conversation);
  if (blocked) return blocked;
  conversationState.set(sessionKey, {
    step: "PAYMENT_AMOUNT",
    data: { customerName: ctx.customerName ?? "Cliente" },
  });
  return handlePaymentStart(conversation);
}

async function handlePaymentStart(conversation: Conversation): Promise<BotResponse[]> {
  const text = "💰 *Cobrança via PIX*\n\nQual o valor? (ex: *50* ou *150,00*)";
  await saveAndReturn(conversation.businessId, conversation.id, [{ text }]);
  return [{ text }];
}

async function handlePaymentAmount(
  ctx: BotContext,
  business: any,
  conversation: Conversation,
  state: any,
  sessionKey: string,
): Promise<BotResponse[]> {
  const raw = ctx.messageBody.replace(/[R$\s]/g, "").replace(",", ".");
  const amount = parseFloat(raw);

  if (isNaN(amount) || amount <= 0) {
    const text =
      "Por favor, informe o valor corretamente (ex: *50* ou *150,00*)";
    await saveAndReturn(business.id, conversation.id, [{ text }]);
    return [{ text }];
  }

  conversationState.delete(sessionKey);

  let responses: BotResponse[];

  try {
    const payment = await createPayment({
      businessId: business.id,
      conversationId: conversation.id,
      customerPhone: ctx.customerPhone,
      customerName: ctx.customerName,
      description: `Sinal - ${business.name}`,
      amount,
      status: "PENDING",
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      externalRef: conversation.id,
    });

    const pix = await createPixCharge({
      businessId: business.id,
      paymentId: payment.id,
      customerName: state.data.customerName ?? ctx.customerName ?? "Cliente",
      customerPhone: ctx.customerPhone,
      description: `Sinal - ${business.name}`,
      amount,
      externalRef: `${business.id}:${payment.id}`,
    });

    await updatePayment(business.id, payment.id, {
      pixQrCode: pix.pixQrCode,
      pixCopyPaste: pix.pixCopyPaste,
      mpPaymentId: pix.mpPaymentId,
    });

    const text =
      `💳 *PIX gerado com sucesso!*\n\n` +
      `Valor: *${formatCurrency(amount)}*\n\n` +
      `*Copia e cola:*\n\`${pix.pixCopyPaste}\`\n\n` +
      `O QR Code foi enviado na mensagem anterior. Validade: 3 dias.`;

    responses = [{ text, imageUrl: `data:image/png;base64,${pix.pixQrCode}` }];
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Erro ao gerar PIX.";
    const text =
      `❌ Não foi possível gerar o PIX de *${formatCurrency(amount)}*.\n\n` +
      `${reason}\n\n` +
      `Tente novamente ou digite *menu*.`;
    responses = [{ text }];
  }

  await saveAndReturn(business.id, conversation.id, responses);
  return responses;
}

async function handleQuote(
  business: any,
  conversation: Conversation,
): Promise<BotResponse[]> {
  if (!business.catalog.length) {
    const text =
      "Você pode nos enviar mais detalhes sobre o que precisa para prepararmos um orçamento personalizado!";
    await saveAndReturn(business.id, conversation.id, [{ text }]);
    return [{ text }];
  }

  let text = `💰 *Tabela de Preços - ${business.name}*\n\n`;
  for (const item of business.catalog) {
    text += `• *${item.name}*: ${formatCurrency(item.price)}\n`;
    if (item.description) text += `  _${item.description}_\n`;
  }
  const v = voc(business);
  text += `\n\nPara ${v.bookingsPlural.toLowerCase()}, use o *menu* ou digite *${v.botAppointmentKeywords[0] ?? "agendar"}*.`;

  await saveAndReturn(business.id, conversation.id, [{ text }]);
  return [{ text }];
}

async function handleFAQ(
  messageBody: string,
  business: any,
  conversation: Conversation,
  sessionKey: string,
): Promise<BotResponse[]> {
  if (!business.faqs?.length) {
    const text =
      `Ainda não há perguntas no *FAQ*.\n\nCadastre no painel ${APP_DISPLAY_NAME} (menu FAQ) para a IA responder automaticamente.`;
    await saveAndReturn(business.id, conversation.id, [{ text }]);
    return [{ text }];
  }

  const faq = matchFaq(messageBody, business.faqs);
  if (faq) {
    await saveAndReturn(business.id, conversation.id, [{ text: faq.answer }]);
    return [{ text: faq.answer }];
  }

  let text = `❓ *FAQ — ${business.name}*\n\n`;
  business.faqs.forEach((f: any, i: number) => {
    text += `${i + 1}. ${f.question}\n`;
  });
  text += "\nDigite o *número* da pergunta (ex: *1*) ou escreva sua dúvida:";

  conversationState.set(sessionKey, { step: "FAQ_SELECT", data: {} });
  await saveAndReturn(business.id, conversation.id, [{ text }]);
  return [{ text }];
}

async function handleFAQSelect(
  ctx: BotContext,
  business: any,
  conversation: Conversation,
  sessionKey: string,
): Promise<BotResponse[]> {
  const faqs = business.faqs ?? [];
  const choice = parseOptionNumber(ctx.messageBody, 1, faqs.length);

  if (choice === null) {
    const byKeyword = matchFaq(ctx.messageBody, faqs);
    if (byKeyword) {
      conversationState.delete(sessionKey);
      await saveAndReturn(business.id, conversation.id, [
        { text: byKeyword.answer },
      ]);
      return [{ text: byKeyword.answer }];
    }
    const text = `Digite o *número* de *1* a *${faqs.length}* ou *menu* para voltar.`;
    await saveAndReturn(business.id, conversation.id, [{ text }]);
    return [{ text }];
  }

  const faq = faqs[choice - 1];
  conversationState.delete(sessionKey);
  await saveAndReturn(business.id, conversation.id, [{ text: faq.answer }]);
  return [{ text: faq.answer }];
}

type MenuPick = {
  num: number;
  label: string;
  response?: string;
  enabled?: boolean;
  emoji?: string;
  action?: BotMenuAction;
};

function getEnabledMenuEntries(business?: {
  botMenu?: unknown[];
  botMenuEnabled?: boolean;
  type?: string;
  mercadoPagoConfigured?: boolean;
  tenantPlan?: string;
}): MenuPick[] {
  if (business?.botMenuEnabled === false) return [];
  let entries: MenuPick[];
  if (business?.botMenu && Array.isArray(business.botMenu) && business.botMenu.length > 0) {
    entries = (business.botMenu as MenuPick[]).filter((e) => e.enabled !== false);
  } else {
    entries = buildBotMenuEntries(business?.type, business?.tenantPlan).map((e) => ({
      num: e.num,
      label: e.label,
      response: legacyMenuResponse(e.action, business?.type),
      action: e.action,
      enabled: true,
    }));
  }
  return ensurePixMenuEntry(entries, business?.mercadoPagoConfigured, business?.tenantPlan);
}

function ensurePixMenuEntry(entries: MenuPick[], mercadoPagoConfigured?: boolean, tenantPlan?: string): MenuPick[] {
  const allowsPix = tenantPlan === "PRO" || tenantPlan === "UNLIMITED";
  const filtered = allowsPix
    ? entries
    : entries.filter((e) => e.action !== "PAYMENT" && !/pix|pagar|pagamento|sinal/i.test(`${e.label} ${e.response ?? ""}`));
  if (!mercadoPagoConfigured || !allowsPix) return filtered;
  const hasPix = filtered.some(
    (e) => e.action === "PAYMENT" || /pix|pagar|pagamento|sinal/i.test(`${e.label} ${e.response ?? ""}`)
  );
  if (hasPix) return filtered;
  const maxNum = filtered.reduce((m, e) => Math.max(m, e.num), 0);
  return [
    ...filtered,
    {
      num: maxNum + 1,
      label: "Pagar com PIX",
      response: "Qual o valor? (ex: *50* ou *150,00*)",
      action: "PAYMENT",
      enabled: true,
      emoji: "💳",
    },
  ];
}

function legacyMenuResponse(action: BotMenuAction, businessType?: string): string {
  const v = getBusinessVocabulary(businessType);
  const map: Record<BotMenuAction, string> = {
    APPOINTMENT: v.botLegacyAppointmentHint,
    CATALOG: v.botLegacyCatalogHint,
    PAYMENT: "Qual o valor? (ex: *50* ou *150,00*)",
    FAQ: "Envie sua dúvida em texto ou digite *dúvida* para ver as perguntas frequentes.",
    HUMAN: "Certo! Vou chamar um atendente. Aguarde um momento... 👤",
    EXIT: "",
  };
  return map[action] ?? "";
}

function resolveMenuSelection(
  text: string,
  business?: { botMenu?: unknown[]; name?: string },
): MenuPick | "EXIT" | null {
  if (isExitCommand(text) || parseOptionNumber(text, 0, 0) === 0) return "EXIT";
  const entries = getEnabledMenuEntries(business);
  if (!entries.length) return null;
  const num = parseOptionNumber(text, 1, entries.length);
  if (num === null) return null;
  return entries[num - 1] ?? null;
}

function isAppointmentMenuItem(item: MenuPick, businessType?: string): boolean {
  if (item.action === "APPOINTMENT") return true;
  const r = (item.response ?? "").toLowerCase();
  const v = getBusinessVocabulary(businessType);
  const hints = [
    ...v.botAppointmentKeywords,
    "informe a data",
    "dd/mm",
    "qual data",
    "marque",
    "reservar",
    "horário prefere",
    "horario prefere",
    "pedido",
    "consulta",
  ];
  return hints.some((h) => r.includes(h));
}

function isCatalogMenuItem(item: MenuPick, businessType?: string): boolean {
  if (item.action === "CATALOG") return true;
  const r = (item.response ?? "").toLowerCase();
  const v = getBusinessVocabulary(businessType);
  return v.botCatalogKeywords.some((k) => r.includes(k));
}

function isFaqMenuItem(item: MenuPick): boolean {
  if (item.action === "FAQ") return true;
  const r = (item.response ?? "").toLowerCase();
  return /\bfaq\b|perguntas frequentes|dúvida|duvida/.test(r);
}

function isHumanMenuItem(item: MenuPick): boolean {
  if (item.action === "HUMAN") return true;
  const r = (item.response ?? "").toLowerCase();
  return /atendente|humano|pessoa/.test(r);
}

function isPaymentMenuItem(item: MenuPick): boolean {
  if (item.action === "PAYMENT") return true;
  const r = `${item.label} ${item.response ?? ""}`.toLowerCase();
  return /pix|pagar|pagamento|sinal/.test(r);
}

async function handleMenuItemSelection(
  item: MenuPick,
  ctx: BotContext,
  business: any,
  conversation: Conversation,
  sessionKey: string,
): Promise<BotResponse[]> {
  if (isAppointmentMenuItem(item, business.type)) {
    if (business.type === "RESTAURANT" && normalizeOrderBotConfig(business.orderBot).enabled) {
      return startOrderFlow(business, conversation, sessionKey, ctx.customerName);
    }
    return startAppointmentFlow(business, conversation, sessionKey, ctx.customerName);
  }
  if (isCatalogMenuItem(item, business.type)) {
    return handleCatalog(business, conversation);
  }
  if (isFaqMenuItem(item)) {
    return handleFAQ(ctx.messageBody, business, conversation, sessionKey);
  }
  if (isPaymentMenuItem(item)) {
    return startPaymentFlow(ctx, business, conversation, sessionKey);
  }
  if (isHumanMenuItem(item)) {
    await updateConversationStatus(business.id, conversation.id, "ATTENDING");
    return saveHumanHandoff(business.id, conversation.id);
  }

  const custom = item.response?.trim();
  if (custom) {
    const text = renderTemplate(custom, {
      nome: ctx.customerName ?? "cliente",
      negocio: business.name,
    });
    await saveAndReturn(business.id, conversation.id, [{ text }]);
    return [{ text }];
  }

  if (item.action && item.action !== "EXIT") {
    return routeMenuAction(
      item.action,
      ctx,
      business,
      conversation,
      sessionKey,
    );
  }

  const fallback =
    "Opção em configuração. Digite *menu* para ver outras opções.";
  await saveAndReturn(business.id, conversation.id, [{ text: fallback }]);
  return [{ text: fallback }];
}

async function routeMenuAction(
  action: BotMenuAction,
  ctx: BotContext,
  business: any,
  conversation: Conversation,
  sessionKey: string,
): Promise<BotResponse[]> {
  switch (action) {
    case "EXIT":
      return handleBotExit(business, conversation, sessionKey);
    case "CATALOG":
      return handleCatalog(business, conversation);
    case "APPOINTMENT":
      if (business.type === "RESTAURANT" && normalizeOrderBotConfig(business.orderBot).enabled) {
        return startOrderFlow(business, conversation, sessionKey, ctx.customerName);
      }
      return startAppointmentFlow(business, conversation, sessionKey, ctx.customerName);
    case "FAQ":
      return handleFAQ(ctx.messageBody, business, conversation, sessionKey);
    case "PAYMENT":
      return startPaymentFlow(ctx, business, conversation, sessionKey);
    case "HUMAN":
      await updateConversationStatus(business.id, conversation.id, "ATTENDING");
      return saveHumanHandoff(business.id, conversation.id);
    default:
      return [{ text: buildMainMenu(business) }];
  }
}

async function saveHumanHandoff(
  businessId: string,
  conversationId: string,
): Promise<BotResponse[]> {
  const msg = "Certo! Vou chamar um atendente. Aguarde um momento... 👤";
  await saveAndReturn(businessId, conversationId, [{ text: msg }]);
  return [{ text: msg }];
}

async function handleBotExit(
  business: any,
  conversation: Conversation,
  sessionKey: string,
): Promise<BotResponse[]> {
  conversationState.delete(sessionKey);
  botPausedSessions.add(sessionKey);
  await clearConversationBotFlowState(business.id, conversation.id).catch(() => undefined);
  await clearLeadFlowIdleFollowUp(business.id, conversation.id).catch(() => undefined);
  if (conversation.status === "ATTENDING") {
    await updateConversationStatus(business.id, conversation.id, "OPEN");
  }
  const text =
    "Fluxo encerrado.\n\n" +
    (isBotMenuEnabled(business)
      ? "Quando quiser voltar, envie *menu* ou qualquer mensagem."
      : "Quando quiser voltar, envie qualquer mensagem ou sua dúvida.");
  await saveAndReturn(business.id, conversation.id, [{ text }]);
  return [{ text }];
}

function isBotMenuEnabled(business?: { botMenuEnabled?: boolean }): boolean {
  return business?.botMenuEnabled !== false;
}

function isGreetingEnabled(business?: { greetingEnabled?: boolean; greetingMsg?: string }): boolean {
  if (business?.greetingEnabled === false) return false;
  return Boolean(business?.greetingMsg?.trim());
}

function thanksReply(business: { name: string; thanksMsg?: string; botMenuEnabled?: boolean }, customerName?: string): string {
  const vars = { nome: customerName ?? "cliente", negocio: business.name };
  const custom = business.thanksMsg?.trim();
  if (custom) return renderTemplate(custom, vars);
  if (isBotMenuEnabled(business)) {
    return renderTemplate("Por nada! 😊 Se precisar de algo, digite *menu*.", vars);
  }
  return renderTemplate("Por nada! 😊 Se tiver outra dúvida, é só enviar.", vars);
}

async function sendPresentation(
  business: any,
  conversation: Conversation,
  customerName?: string,
): Promise<BotResponse[]> {
  const out: BotResponse[] = [];

  if (isGreetingEnabled(business)) {
    const text = renderTemplate(business.greetingMsg, {
      nome: customerName ?? "cliente",
      negocio: business.name,
    });
    out.push({ text });
  }

  if (isBotMenuEnabled(business)) {
    const menu = buildMainMenu(business);
    if (menu.trim()) out.push({ text: menu });
  }

  if (!out.length) return [];

  await saveAndReturn(business.id, conversation.id, out);
  return out;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildMainMenu(business: {
  name: string;
  botMenu?: unknown[];
  botMenuEnabled?: boolean;
}): string {
  if (!isBotMenuEnabled(business)) return "";
  const entries = getEnabledMenuEntries(business).map((e, i) => ({
    ...e,
    num: i + 1,
  }));
  if (!entries.length) {
    return (
      `*${business.name}*\n\n` +
      `_Menu ainda não configurado no painel. Enquanto isso, envie sua mensagem que a IA tenta ajudar._`
    );
  }
  let text = `*Menu — ${business.name}*\n\n`;
  for (const e of entries) {
    const prefix = e.emoji ? `${e.emoji} ` : "";
    text += `*${e.num}* — ${prefix}${e.label}\n`;
  }
  text += `\n*0* — 👋 Sair\n\n`;
  text += `_Digite o número da opção desejada_`;
  return text;
}

function buildFallbackMessage(business?: { botMenu?: unknown[]; botMenuEnabled?: boolean }): string {
  if (!isBotMenuEnabled(business)) {
    return "Não encontrei uma resposta. Reformule sua pergunta ou use palavras das FAQs cadastradas.";
  }
  const n = getEnabledMenuEntries(business).length;
  if (n > 0) {
    return `Não entendi. 😅\n\nDigite um número de *1* a *${n}*, *menu* ou *sair*.`;
  }
  return "Não entendi. 😅\n\nDigite *menu* ou descreva o que precisa.";
}

function looksLikeAppointmentDate(text: string): boolean {
  return /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(text.trim());
}

function isThanks(text: string): boolean {
  const t = text.toLowerCase().trim();
  return ["obrigado", "obrigada", "valeu", "vlw", "brigadão", "brigadao"].some((w) => t.includes(w));
}

function matchFaq(text: string, faqs: any[] | undefined): any | null {
  if (!text.trim() || !faqs?.length) return null;
  return findMatchingFaq(text, faqs);
}

async function saveAndReturn(
  businessId: string,
  conversationId: string,
  responses: BotResponse[],
): Promise<void> {
  if (shouldDeferReplyPersistence()) return;
  await createMessages(businessId, conversationId, mapBotResponsesToMessages(responses));
}

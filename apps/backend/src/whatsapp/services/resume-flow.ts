import {
  applyResumeReply,
  buildResumeEditKeywords,
  buildResumeEditMenuText,
  buildResumeReviewText,
  getResumeFlowStep,
  getResumeDocumentLabel,
  isResumeSkipReply,
  nextResumeStepId,
  normalizeResumeFlowConfig,
  parseResumeData,
  renderTemplate,
  resolveResumeEditChoice,
  resumeEditTriggerMatch,
  resumeFlowTemplateVars,
  resumeFlowStartKeywords,
  resumeFlowTriggerMatch,
  resumeStepAck,
  resumeStepPrompt,
  serializeResumeData,
  validateResumeStepReply,
  type ResumeFlowConfig,
  type ResumeFlowStepId,
} from "@flowdesk/shared";
import type { Conversation } from "@flowdesk/firebase";
import {
  clearConversationBotFlowState,
  setConversationBotFlowState,
} from "@flowdesk/firebase";
import type { BotContext, BotResponse } from "./bot.js";
import { buildResumePdf, resumePdfFilename } from "./resume-pdf.js";

type ResumeState = { step: "RESUME_FLOW"; data: Record<string, string> };
type FlowStateMap = Map<string, { step: string; data: Record<string, string> }>;

function parseExpDraft(raw?: string) {
  if (!raw?.trim()) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

async function persistState(
  businessId: string,
  conversationId: string,
  sessionKey: string,
  map: FlowStateMap,
  state: ResumeState,
) {
  map.set(sessionKey, state);
  await setConversationBotFlowState(businessId, conversationId, state);
}

async function clearState(
  businessId: string,
  conversationId: string,
  sessionKey: string,
  map: FlowStateMap,
) {
  map.delete(sessionKey);
  await clearConversationBotFlowState(businessId, conversationId).catch(() => undefined);
}

function resumeState(
  stepId: ResumeFlowStepId,
  fields: string,
  expDraft = "{}",
  extras: Record<string, string> = {},
): ResumeState {
  return { step: "RESUME_FLOW", data: { stepId, fields, expDraft, ...extras } };
}

export function isResumeFlowActive(state?: { step: string } | null): boolean {
  return state?.step === "RESUME_FLOW";
}

export function isResumeFlowFinalized(state?: { step: string; data?: Record<string, string> } | null): boolean {
  return (
    (state?.step === "RESUME_FLOW" && state.data?.stepId === "finalizado") ||
    state?.step === "RESUME_ARCHIVE"
  );
}

export function resumeArchivedFields(state?: { step: string; data?: Record<string, string> } | null): string | null {
  if (!state?.data?.fields) return null;
  if (state.step === "RESUME_FLOW" && state.data.stepId === "finalizado") return state.data.fields;
  if (state.step === "RESUME_ARCHIVE") return state.data.fields;
  return null;
}

export function getResumeFlowConfig(business: {
  resumeFlow?: ResumeFlowConfig | null;
}): ResumeFlowConfig | null {
  const cfg = normalizeResumeFlowConfig(business.resumeFlow);
  if (!cfg.enabled) return null;
  return cfg;
}

export function shouldStartResumeFlow(
  business: { resumeFlow?: ResumeFlowConfig | null },
  messageBody: string,
): boolean {
  const cfg = getResumeFlowConfig(business);
  if (!cfg) return false;
  return resumeFlowTriggerMatch(messageBody, resumeFlowStartKeywords(cfg));
}

export function shouldEditResumeDocument(
  business: { resumeFlow?: ResumeFlowConfig | null },
  messageBody: string,
  state?: { step: string; data?: Record<string, string> } | null,
): boolean {
  const cfg = getResumeFlowConfig(business);
  if (!cfg) return false;
  if (!resumeEditTriggerMatch(messageBody, buildResumeEditKeywords(cfg.documentLabel))) return false;
  return Boolean(resumeArchivedFields(state));
}

function stepResponse(
  config: ResumeFlowConfig,
  stepId: ResumeFlowStepId,
  businessName: string,
  customerName?: string,
  data?: ReturnType<typeof parseResumeData>,
): BotResponse[] {
  const vars = resumeFlowTemplateVars(config, businessName, customerName, data);
  const step = getResumeFlowStep(stepId);
  let text = "";
  if (stepId === "revisao" && data) {
    text = buildResumeReviewText(data, vars.documento);
  } else if (stepId === "editar_menu") {
    text = buildResumeEditMenuText();
  } else {
    text = renderTemplate(resumeStepPrompt(config, stepId), vars).trim();
  }
  if (!text && stepId !== "done") return [];
  if (step?.buttons?.length) {
    return [
      {
        text,
        buttons: step.buttons.map((b) => ({
          id: b.id,
          label: renderTemplate(b.label, vars),
        })),
      },
    ];
  }
  return [{ text }];
}

function withAck(stepId: ResumeFlowStepId | null, responses: BotResponse[]): BotResponse[] {
  if (!stepId || !responses.length) return responses;
  const ack = resumeStepAck(stepId);
  if (!ack) return responses;
  return [{ ...responses[0], text: `${ack}\n\n${responses[0].text}`.trim() }, ...responses.slice(1)];
}

function validationError(cfg: ResumeFlowConfig, stepId: ResumeFlowStepId, err: string, businessName: string, customerName?: string, data?: ReturnType<typeof parseResumeData>): BotResponse[] {
  const prompt = renderTemplate(resumeStepPrompt(cfg, stepId), resumeFlowTemplateVars(cfg, businessName, customerName, data)).trim();
  return [{ text: `⚠️ ${err}\n\n${prompt}` }];
}

export async function startResumeFlow(
  business: { id: string; name: string; resumeFlow?: ResumeFlowConfig | null },
  conversation: Conversation,
  customerName: string | undefined,
  sessionKey: string,
  conversationState: FlowStateMap,
  saveAndReturn: (businessId: string, conversationId: string, responses: BotResponse[]) => Promise<void>,
): Promise<BotResponse[]> {
  const cfg = getResumeFlowConfig(business);
  if (!cfg) return [];
  await persistState(
    business.id,
    conversation.id,
    sessionKey,
    conversationState,
    resumeState("welcome", serializeResumeData(parseResumeData("{}"))),
  );
  const out = stepResponse(cfg, "welcome", business.name, customerName);
  if (!out.length) return [];
  await saveAndReturn(business.id, conversation.id, out);
  return out;
}

export async function openResumeReview(
  business: { id: string; name: string; resumeFlow?: ResumeFlowConfig | null },
  conversation: Conversation,
  customerName: string | undefined,
  sessionKey: string,
  conversationState: FlowStateMap,
  saveAndReturn: (businessId: string, conversationId: string, responses: BotResponse[]) => Promise<void>,
  fields: string,
): Promise<BotResponse[]> {
  const cfg = getResumeFlowConfig(business);
  if (!cfg) return [];
  const data = parseResumeData(fields);
  await persistState(business.id, conversation.id, sessionKey, conversationState, resumeState("revisao", fields));
  const out = stepResponse(cfg, "revisao", business.name, customerName, data);
  await saveAndReturn(business.id, conversation.id, out);
  return out;
}

async function finishResumeFlow(
  business: { id: string; name: string; resumeFlow?: ResumeFlowConfig | null },
  conversation: Conversation,
  data: ReturnType<typeof parseResumeData>,
  customerName: string | undefined,
  sessionKey: string,
  conversationState: FlowStateMap,
  saveAndReturn: (businessId: string, conversationId: string, responses: BotResponse[]) => Promise<void>,
): Promise<BotResponse[]> {
  const cfg = getResumeFlowConfig(business);
  const vars = resumeFlowTemplateVars(cfg ?? normalizeResumeFlowConfig(null), business.name, customerName, data);
  const documentLabel = getResumeDocumentLabel(cfg);
  const buffer = await buildResumePdf(data, documentLabel);
  const filename = resumePdfFilename(data, documentLabel);
  const success =
    cfg?.successMessage?.trim() ||
    `Pronto, {nome}! Seus dados foram registrados e o {documento} em PDF foi enviado para nossa equipe.\n\nPara corrigir algo, digite *editar {documento}*.`;
  const notifyPhone = cfg?.notifyPhone?.replace(/\D/g, "") ?? "";
  const notifySelf = cfg?.notifySelf === true;
  const fields = serializeResumeData(data);

  if (!notifySelf && !notifyPhone) {
    const out = [
      {
        text: "Não foi possível concluir: o WhatsApp da equipe ainda não está configurado no sistema. Tente novamente mais tarde.",
      },
    ];
    await saveAndReturn(business.id, conversation.id, out);
    return out;
  }

  await persistState(business.id, conversation.id, sessionKey, conversationState, resumeState("finalizado", fields));

  const out: BotResponse[] = [
    {
      text: "",
      documentBuffer: buffer,
      documentFilename: filename,
      documentMimetype: "application/pdf",
      documentLabel,
      alsoSendDocumentTo: notifySelf ? undefined : notifyPhone,
      sendDocumentToSelf: notifySelf,
      sendDocumentToTeamOnly: true,
    },
    { text: renderTemplate(success, vars) },
  ];
  await saveAndReturn(business.id, conversation.id, out);
  return out;
}

export async function handleResumeFlowMessage(
  ctx: BotContext,
  business: { id: string; name: string; resumeFlow?: ResumeFlowConfig | null },
  conversation: Conversation,
  state: ResumeState,
  sessionKey: string,
  conversationState: FlowStateMap,
  saveAndReturn: (businessId: string, conversationId: string, responses: BotResponse[]) => Promise<void>,
): Promise<BotResponse[]> {
  const cfg = getResumeFlowConfig(business);
  if (!cfg) {
    await clearState(business.id, conversation.id, sessionKey, conversationState);
    return [];
  }

  const stepId = (state.data.stepId as ResumeFlowStepId) || "welcome";
  const reply = ctx.messageBody.trim();
  const step = getResumeFlowStep(stepId);
  let data = parseResumeData(state.data.fields ?? "{}");
  const editKeywords = buildResumeEditKeywords(cfg.documentLabel);

  if (stepId === "finalizado") {
    if (resumeEditTriggerMatch(reply, editKeywords)) {
      return openResumeReview(
        business,
        conversation,
        ctx.customerName,
        sessionKey,
        conversationState,
        saveAndReturn,
        state.data.fields ?? "{}",
      );
    }
    if (resumeFlowTriggerMatch(reply, resumeFlowStartKeywords(cfg))) {
      return startResumeFlow(
        business,
        conversation,
        ctx.customerName,
        sessionKey,
        conversationState,
        saveAndReturn,
      );
    }
    return [];
  }

  if (stepId === "revisao") {
    const lower = reply.toLowerCase();
    if (lower === "doc_confirmar" || lower.includes("gerar")) {
      return finishResumeFlow(
        business,
        conversation,
        data,
        ctx.customerName,
        sessionKey,
        conversationState,
        saveAndReturn,
      );
    }
    if (lower === "doc_editar" || lower.includes("editar")) {
      await persistState(
        business.id,
        conversation.id,
        sessionKey,
        conversationState,
        resumeState("editar_menu", state.data.fields ?? "{}"),
      );
      const out = stepResponse(cfg, "editar_menu", business.name, ctx.customerName);
      await saveAndReturn(business.id, conversation.id, out);
      return out;
    }
    const out = stepResponse(cfg, "revisao", business.name, ctx.customerName, data);
    await saveAndReturn(business.id, conversation.id, out);
    return out;
  }

  if (stepId === "editar_menu") {
    const choice = resolveResumeEditChoice(reply);
    if (!choice) {
      const out = [{ text: "Opção inválida. Envie o *número* do campo ou *0* para voltar à revisão." }, ...stepResponse(cfg, "editar_menu", business.name, ctx.customerName)];
      await saveAndReturn(business.id, conversation.id, out);
      return out;
    }
    if (choice === "review") {
      return openResumeReview(
        business,
        conversation,
        ctx.customerName,
        sessionKey,
        conversationState,
        saveAndReturn,
        state.data.fields ?? "{}",
      );
    }
    if (choice.clearsExperiences) {
      data = { ...data, experiencias: [] };
    }
    const prompt = renderTemplate(
      getResumeFlowStep(choice.stepId)?.prompt ?? `Informe o novo valor para *${choice.label}*:`,
      resumeFlowTemplateVars(cfg, business.name, ctx.customerName, data),
    );
    const extras = choice.clearsExperiences ? {} : { returnToReview: "1" };
    await persistState(
      business.id,
      conversation.id,
      sessionKey,
      conversationState,
      resumeState(choice.stepId, serializeResumeData(data), "{}", extras),
    );
    const out = [{ text: `✏️ ${choice.label}\n\n${prompt}` }];
    await saveAndReturn(business.id, conversation.id, out);
    return out;
  }

  if (stepId === "welcome") {
    const err = validateResumeStepReply("nome", reply);
    if (err) {
      const out = validationError(cfg, "nome", err, business.name, ctx.customerName, data);
      await saveAndReturn(business.id, conversation.id, out);
      return out;
    }
    const applied = applyResumeReply(data, "nome", reply, {});
    data = applied.data;
    const nextId = "idade";
    await persistState(
      business.id,
      conversation.id,
      sessionKey,
      conversationState,
      resumeState(nextId, serializeResumeData(data), "{}"),
    );
    const out = withAck("nome", stepResponse(cfg, nextId, business.name, ctx.customerName, data));
    await saveAndReturn(business.id, conversation.id, out);
    return out;
  }

  if (step?.optional && isResumeSkipReply(reply)) {
    const expDraft = parseExpDraft(state.data.expDraft);
    const applied = applyResumeReply(data, stepId, reply, expDraft);
    data = applied.data;
    if (state.data.returnToReview === "1") {
      return openResumeReview(
        business,
        conversation,
        ctx.customerName,
        sessionKey,
        conversationState,
        saveAndReturn,
        serializeResumeData(data),
      );
    }
    const nextId = nextResumeStepId(stepId, reply, { expDraft: applied.expDraft });
    if (!nextId || nextId === "done") {
      return finishResumeFlow(
        business,
        conversation,
        data,
        ctx.customerName,
        sessionKey,
        conversationState,
        saveAndReturn,
      );
    }
    await persistState(
      business.id,
      conversation.id,
      sessionKey,
      conversationState,
      resumeState(nextId, serializeResumeData(data), JSON.stringify(applied.expDraft)),
    );
    const out = stepResponse(cfg, nextId, business.name, ctx.customerName, data);
    await saveAndReturn(business.id, conversation.id, out);
    return out;
  }

  const fieldErr = validateResumeStepReply(stepId, reply);
  if (fieldErr) {
    const out = validationError(cfg, stepId, fieldErr, business.name, ctx.customerName, data);
    await saveAndReturn(business.id, conversation.id, out);
    return out;
  }

  if (stepId !== "exp_mais" && !reply) {
    const out = [{ text: "Por favor, envie uma resposta válida ou digite *pular* se for opcional." }];
    await saveAndReturn(business.id, conversation.id, out);
    return out;
  }

  if (step?.buttons?.length && stepId === "exp_mais") {
    const lower = reply.toLowerCase();
    const valid = lower === "exp_sim" || lower.includes("sim") || lower === "exp_nao" || lower.includes("não") || lower.includes("nao");
    if (!valid) {
      const out = stepResponse(cfg, stepId, business.name, ctx.customerName);
      await saveAndReturn(business.id, conversation.id, out);
      return out;
    }
  }

  const expDraft = parseExpDraft(state.data.expDraft);
  const applied = applyResumeReply(data, stepId, reply, expDraft);
  data = applied.data;

  if (state.data.returnToReview === "1") {
    return openResumeReview(
      business,
      conversation,
      ctx.customerName,
      sessionKey,
      conversationState,
      saveAndReturn,
      serializeResumeData(data),
    );
  }

  const nextId = nextResumeStepId(stepId, reply, { expDraft: applied.expDraft });
  if (!nextId || nextId === "done") {
    return finishResumeFlow(
      business,
      conversation,
      data,
      ctx.customerName,
      sessionKey,
      conversationState,
      saveAndReturn,
    );
  }

  await persistState(
    business.id,
    conversation.id,
    sessionKey,
    conversationState,
    resumeState(nextId, serializeResumeData(data), JSON.stringify(applied.expDraft)),
  );
  const out = withAck(stepId, stepResponse(cfg, nextId, business.name, ctx.customerName, data));
  await saveAndReturn(business.id, conversation.id, out);
  return out;
}

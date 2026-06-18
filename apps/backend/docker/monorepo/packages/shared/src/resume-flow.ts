export const DEFAULT_RESUME_DOCUMENT_LABEL = "documento";

export const DEFAULT_RESUME_FLOW_KEYWORDS = [
  "curriculo",
  "currículo",
  "documento",
  "gerar documento",
  "criar documento",
  "montar documento",
  "pdf",
];

export const DEFAULT_RESUME_EDIT_KEYWORDS = [
  "editar documento",
  "editar dados",
  "corrigir documento",
  "corrigir dados",
  "atualizar documento",
  "alterar documento",
  "editar pdf",
];

export const RESUME_FLOW_SKIP_REPLIES = new Set([
  "pular",
  "skip",
  "nao tenho",
  "não tenho",
  "nao",
  "não",
  "n/a",
  "-",
  "sem",
]);

export interface ResumeExperience {
  empresa: string;
  cargo: string;
  periodo: string;
  atividades: string;
}

export interface ResumeData {
  nome: string;
  idade: string;
  estadoCivil?: string;
  cidadeBairro: string;
  telefone: string;
  email: string;
  cnh?: string;
  escolaridadeNivel: string;
  escolaridadeCurso: string;
  experiencias: ResumeExperience[];
  cursos?: string;
  objetivo?: string;
}

export interface ResumeFlowConfig {
  enabled: boolean;
  documentLabel: string;
  triggerKeywords: string[];
  notifyPhone: string;
  notifySelf?: boolean;
  welcomeMessage?: string;
  successMessage?: string;
}

export type ResumeFlowStepId =
  | "welcome"
  | "nome"
  | "idade"
  | "estado_civil"
  | "cidade_bairro"
  | "telefone"
  | "email"
  | "cnh"
  | "escolaridade_nivel"
  | "escolaridade_curso"
  | "exp_empresa"
  | "exp_cargo"
  | "exp_periodo"
  | "exp_atividades"
  | "exp_mais"
  | "cursos"
  | "objetivo"
  | "revisao"
  | "editar_menu"
  | "done"
  | "finalizado";

export interface ResumeFlowStep {
  id: ResumeFlowStepId;
  prompt: string;
  optional?: boolean;
  buttons?: { id: string; label: string }[];
}

const DEFAULT_WELCOME =
  "Para montar seu *{documento}*, preciso que você me envie as seguintes informações:\n\n*1. Dados pessoais*\n• Nome completo\n• Idade ou data de nascimento\n• Estado civil _(opcional)_\n• Cidade e bairro onde mora\n• Telefone (WhatsApp)\n• E-mail\n• CNH _(opcional)_\n\n*2. Escolaridade*\n• Nível de ensino (fundamental, médio, técnico ou superior)\n• Curso e situação (completo ou em andamento)\n\n*3. Experiência profissional*\n• Nome da empresa ou tipo de trabalho\n• Cargo ou função exercida\n• Período de trabalho (ex: 2022 a 2024)\n• Principais atividades realizadas\n\n*4. Cursos ou qualificações* _(se tiver)_\n\n*5. Objetivo profissional* _(opcional)_\n\nSe não tiver alguma informação opcional, responda *pular*.\n\nVou pedir *um dado por vez*. Envie seu *nome completo* para começar:";

const DEFAULT_SUCCESS =
  "Pronto, {nome}! Seus dados foram registrados e o {documento} em PDF foi enviado para nossa equipe.\n\nPara corrigir algo, digite *editar {documento}*.";

export const RESUME_FLOW_STEPS: ResumeFlowStep[] = [
  { id: "welcome", prompt: DEFAULT_WELCOME },
  { id: "nome", prompt: "*Nome completo:*\nEnvie seu nome completo (nome e sobrenome)." },
  {
    id: "idade",
    prompt: "*Idade ou data de nascimento:*\nEnvie sua idade (ex: 28) ou data (ex: 15/03/1995).",
  },
  {
    id: "estado_civil",
    prompt: "*Estado civil* _(opcional):_\nInforme ou responda *pular*.",
    optional: true,
  },
  {
    id: "cidade_bairro",
    prompt: "*Cidade e bairro:*\nInforme cidade e bairro onde mora (ex: São Paulo — Centro).",
  },
  {
    id: "telefone",
    prompt: "*Telefone (WhatsApp):*\nEnvie o número com DDD (ex: 11 99999-9999).",
  },
  { id: "email", prompt: "*E-mail:*\nEnvie um e-mail válido para contato." },
  {
    id: "cnh",
    prompt: "*CNH* _(opcional):_\nInforme a categoria (ex: B) ou responda *pular*.",
    optional: true,
  },
  {
    id: "escolaridade_nivel",
    prompt:
      "📚 *Escolaridade*\n\n*Nível de ensino:*\nFundamental, médio, técnico ou superior.",
  },
  {
    id: "escolaridade_curso",
    prompt: "*Curso e situação:*\nEx: Administração — completo / em andamento.",
  },
  {
    id: "exp_empresa",
    prompt: "💼 *Experiência profissional*\n\n*Empresa ou tipo de trabalho:*",
  },
  { id: "exp_cargo", prompt: "*Cargo ou função exercida:*" },
  { id: "exp_periodo", prompt: "*Período de trabalho:*\nEx: 2022 a 2024." },
  { id: "exp_atividades", prompt: "*Principais atividades realizadas:*" },
  {
    id: "exp_mais",
    prompt: "Deseja adicionar *outra experiência profissional*?",
    buttons: [
      { id: "exp_sim", label: "Sim, adicionar" },
      { id: "exp_nao", label: "Não, continuar" },
    ],
  },
  { id: "cursos", prompt: "*Cursos ou qualificações* _(opcional):_\nListe ou responda *pular*.", optional: true },
  { id: "objetivo", prompt: "*Objetivo profissional* _(opcional):_\nInforme ou responda *pular*.", optional: true },
  {
    id: "revisao",
    prompt: "",
    buttons: [
      { id: "doc_confirmar", label: "Gerar {documento}" },
      { id: "doc_editar", label: "Editar dados" },
    ],
  },
  { id: "editar_menu", prompt: "" },
  { id: "done", prompt: "Gerando seu {documento} em PDF..." },
  { id: "finalizado", prompt: "" },
];

export function defaultResumeFlowConfig(): ResumeFlowConfig {
  return {
    enabled: false,
    documentLabel: DEFAULT_RESUME_DOCUMENT_LABEL,
    triggerKeywords: [...DEFAULT_RESUME_FLOW_KEYWORDS],
    notifyPhone: "",
    notifySelf: false,
    welcomeMessage: DEFAULT_WELCOME,
    successMessage: DEFAULT_SUCCESS,
  };
}

export function getResumeDocumentLabel(config?: Pick<ResumeFlowConfig, "documentLabel"> | null): string {
  const label = config?.documentLabel?.trim();
  return label || DEFAULT_RESUME_DOCUMENT_LABEL;
}

export function resumeFlowTemplateVars(
  config: ResumeFlowConfig,
  businessName: string,
  customerName?: string,
  data?: Partial<ResumeData>,
): Record<string, string> {
  const documento = getResumeDocumentLabel(config);
  return {
    nome: data?.nome?.trim() || customerName?.trim() || "cliente",
    negocio: businessName,
    documento,
  };
}

export function buildResumeEditKeywords(documentLabel?: string): string[] {
  const label = getResumeDocumentLabel({ documentLabel: documentLabel ?? "" });
  const lower = label.toLowerCase();
  const extra =
    lower === DEFAULT_RESUME_DOCUMENT_LABEL
      ? []
      : [`editar ${lower}`, `corrigir ${lower}`, `atualizar ${lower}`, lower];
  return [...new Set([...DEFAULT_RESUME_EDIT_KEYWORDS, ...extra])];
}

export function hasResumeNotifyTarget(raw?: ResumeFlowConfig | null): boolean {
  if (raw?.notifySelf === true) return true;
  const cfg = normalizeResumeFlowConfig(raw);
  if (cfg.notifySelf === true) return true;
  return Boolean(cfg.notifyPhone.replace(/\D/g, ""));
}

export function normalizeResumeFlowConfig(raw?: ResumeFlowConfig | null): ResumeFlowConfig {
  const base = defaultResumeFlowConfig();
  if (!raw) return base;
  return {
    enabled: raw.enabled === true,
    documentLabel: getResumeDocumentLabel({ documentLabel: raw.documentLabel }),
    triggerKeywords: (raw.triggerKeywords ?? base.triggerKeywords)
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean),
    notifyPhone: String(raw.notifyPhone ?? "").replace(/\D/g, ""),
    notifySelf: raw.notifySelf === true,
    welcomeMessage: raw.welcomeMessage?.trim() || base.welcomeMessage,
    successMessage: raw.successMessage?.trim() || base.successMessage,
  };
}

export function resumeFlowStartKeywords(config: ResumeFlowConfig): string[] {
  const label = getResumeDocumentLabel(config).toLowerCase();
  const extras = label ? [label, `gerar ${label}`, `criar ${label}`] : [];
  return [...new Set([...config.triggerKeywords, ...extras])];
}

export function resumeFlowTriggerMatch(text: string, keywords: string[]): boolean {
  const normalized = text.toLowerCase().trim();
  if (!normalized || !keywords.length) return false;
  return keywords.some((kw) => normalized.includes(kw));
}

export function resumeEditTriggerMatch(text: string, keywords = DEFAULT_RESUME_EDIT_KEYWORDS): boolean {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return false;
  return keywords.some((kw) => normalized.includes(kw));
}

export function isResumeReviewEditReply(text: string, editKeywords = DEFAULT_RESUME_EDIT_KEYWORDS): boolean {
  const lower = text.trim().toLowerCase();
  if (!lower) return false;
  if (lower === "doc_editar" || lower === "editar dados") return true;
  if (lower.includes("editar") || lower.includes("corrigir") || lower.includes("alterar")) return true;
  return resumeEditTriggerMatch(text, editKeywords);
}

export function isResumeReviewConfirmReply(text: string): boolean {
  const lower = text.trim().toLowerCase();
  if (!lower) return false;
  if (lower === "doc_confirmar") return true;
  return lower.includes("gerar");
}

export const RESUME_EDIT_FIELDS: { num: number; stepId: ResumeFlowStepId; label: string; clearsExperiences?: boolean }[] = [
  { num: 1, stepId: "nome", label: "Nome completo" },
  { num: 2, stepId: "idade", label: "Idade / nascimento" },
  { num: 3, stepId: "estado_civil", label: "Estado civil" },
  { num: 4, stepId: "cidade_bairro", label: "Cidade e bairro" },
  { num: 5, stepId: "telefone", label: "Telefone" },
  { num: 6, stepId: "email", label: "E-mail" },
  { num: 7, stepId: "cnh", label: "CNH" },
  { num: 8, stepId: "escolaridade_nivel", label: "Nível de ensino" },
  { num: 9, stepId: "escolaridade_curso", label: "Curso / situação" },
  { num: 10, stepId: "exp_empresa", label: "Experiências profissionais", clearsExperiences: true },
  { num: 11, stepId: "cursos", label: "Cursos e qualificações" },
  { num: 12, stepId: "objetivo", label: "Objetivo profissional" },
];

export function buildResumeEditMenuText(): string {
  const lines = RESUME_EDIT_FIELDS.map((f) => `*${f.num}* — ${f.label}`);
  return `Qual informação deseja *alterar*?\n\n${lines.join("\n")}\n\n*0* — Voltar à revisão`;
}

export function resolveResumeEditChoice(reply: string): (typeof RESUME_EDIT_FIELDS)[number] | "review" | null {
  const t = reply.trim().toLowerCase();
  if (t === "0" || t.includes("voltar") || t.includes("revis")) return "review";
  const num = parseInt(t.replace(/\D/g, ""), 10);
  if (!Number.isFinite(num)) return null;
  return RESUME_EDIT_FIELDS.find((f) => f.num === num) ?? null;
}

function dash(value?: string) {
  return value?.trim() || "—";
}

export function buildResumeReviewText(data: ResumeData, documento = DEFAULT_RESUME_DOCUMENT_LABEL): string {
  const lines = [
    `📋 *Revise seus dados antes de gerar o ${documento}:*`,
    "",
    `*Nome:* ${dash(data.nome)}`,
    `*Idade:* ${dash(data.idade)}`,
    `*Estado civil:* ${dash(data.estadoCivil)}`,
    `*Cidade / bairro:* ${dash(data.cidadeBairro)}`,
    `*Telefone:* ${dash(data.telefone)}`,
    `*E-mail:* ${dash(data.email)}`,
    `*CNH:* ${dash(data.cnh)}`,
    `*Escolaridade:* ${dash(data.escolaridadeNivel)} — ${dash(data.escolaridadeCurso)}`,
  ];
  if (data.experiencias.length) {
    lines.push("", "*Experiências:*");
    for (const exp of data.experiencias) {
      lines.push(`• ${exp.cargo} — ${exp.empresa} (${exp.periodo})`);
      lines.push(`  ${exp.atividades}`);
    }
  } else {
    lines.push("", "*Experiências:* —");
  }
  lines.push(`*Cursos:* ${dash(data.cursos)}`);
  lines.push(`*Objetivo:* ${dash(data.objetivo)}`);
  lines.push("", `Está tudo certo? Toque em *Gerar ${documento}* ou *Editar dados*.`);
  return lines.join("\n");
}

export function isResumeSkipReply(text: string): boolean {
  const t = text.toLowerCase().trim().replace(/[.!?,]/g, "");
  return RESUME_FLOW_SKIP_REPLIES.has(t);
}

export function getResumeFlowStep(id: ResumeFlowStepId): ResumeFlowStep | null {
  return RESUME_FLOW_STEPS.find((s) => s.id === id) ?? null;
}

export function resumeStepIndex(id: ResumeFlowStepId): number {
  return RESUME_FLOW_STEPS.findIndex((s) => s.id === id);
}

export function nextResumeStepId(
  current: ResumeFlowStepId,
  reply: string,
  ctx: { expDraft?: Partial<ResumeExperience> },
): ResumeFlowStepId | null {
  const idx = resumeStepIndex(current);
  if (idx < 0) return null;

  if (current === "exp_mais") {
    const lower = reply.toLowerCase().trim();
    if (lower === "exp_sim" || lower.includes("sim")) return "exp_empresa";
    return "cursos";
  }

  if (current === "exp_atividades") return "exp_mais";
  if (current === "done" || current === "finalizado") return null;

  const step = RESUME_FLOW_STEPS[idx];
  if (step?.optional && isResumeSkipReply(reply)) {
    const next = RESUME_FLOW_STEPS[idx + 1];
    if (next?.id === "done") return "revisao";
    return next?.id ?? null;
  }

  if (current === "welcome") return "nome";

  const next = RESUME_FLOW_STEPS[idx + 1];
  if (next?.id === "done") return "revisao";
  return next?.id ?? null;
}

const ESCOLARIDADE_LEVELS = ["fundamental", "médio", "medio", "técnico", "tecnico", "superior", "pos", "pós", "mestrado", "doutorado"];
const CNH_CATEGORY = /^(ACC|[A-E](?:[CDE])?|AB)$/i;

export function validateResumeStepReply(stepId: ResumeFlowStepId, reply: string): string | null {
  const text = reply.trim();
  if (!text) return "Envie uma resposta para continuar.";
  const step = getResumeFlowStep(stepId);
  if (step?.optional && isResumeSkipReply(text)) return null;
  if (
    stepId === "welcome" ||
    stepId === "exp_mais" ||
    stepId === "revisao" ||
    stepId === "editar_menu" ||
    stepId === "done" ||
    stepId === "finalizado"
  ) {
    return null;
  }

  switch (stepId) {
    case "nome": {
      if (text.length < 4) return "Nome muito curto. Envie o *nome completo*.";
      if (text.split(/\s+/).filter(Boolean).length < 2) {
        return "Preciso do *nome completo* (nome e sobrenome).";
      }
      if (!/^[\p{L}\s'.-]+$/u.test(text)) return "Use apenas letras no nome.";
      return null;
    }
    case "idade": {
      if (/^\d{1,3}$/.test(text)) {
        const n = Number(text);
        if (n >= 14 && n <= 100) return null;
        return "Informe uma idade entre *14 e 100* anos.";
      }
      if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(text)) return null;
      return "Informe a *idade* (ex: 28) ou *data de nascimento* (ex: 15/03/1995).";
    }
    case "estado_civil":
    case "cursos":
    case "objetivo":
      return text.length >= 2 ? null : "Resposta inválida. Informe o dado ou digite *pular*.";
    case "cnh": {
      if (CNH_CATEGORY.test(text.replace(/\s+/g, ""))) return null;
      return text.length >= 2 ? null : "Resposta inválida. Informe o dado ou digite *pular*.";
    }
    case "cidade_bairro":
      return text.length >= 4 ? null : "Informe *cidade e bairro* (mín. 4 caracteres).";
    case "telefone": {
      const digits = text.replace(/\D/g, "");
      if (digits.length >= 10 && digits.length <= 15) return null;
      return "Telefone inválido. Envie com DDD (10 a 15 dígitos).";
    }
    case "email": {
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return null;
      return "E-mail inválido. Ex: nome@email.com";
    }
    case "escolaridade_nivel": {
      const lower = text.toLowerCase();
      if (ESCOLARIDADE_LEVELS.some((l) => lower.includes(l))) return null;
      return "Informe: *fundamental*, *médio*, *técnico* ou *superior*.";
    }
    case "escolaridade_curso":
      return text.length >= 4 ? null : "Descreva o *curso* e situação (mín. 4 caracteres).";
    case "exp_empresa":
    case "exp_cargo":
      return text.length >= 2 ? null : "Resposta muito curta. Detalhe um pouco mais.";
    case "exp_periodo":
      if (/\d{4}/.test(text) || /\d{1,2}\/\d{4}/.test(text)) return null;
      return "Informe o *período* com ano (ex: 2022 a 2024).";
    case "exp_atividades":
      return text.length >= 8 ? null : "Descreva as atividades com mais detalhes (mín. 8 caracteres).";
    default:
      return null;
  }
}

export function resumeStepAck(stepId: ResumeFlowStepId): string | null {
  const map: Partial<Record<ResumeFlowStepId, string>> = {
    nome: "✅ Nome registrado!",
    idade: "✅ Idade registrada!",
    estado_civil: "✅ Estado civil registrado!",
    cidade_bairro: "✅ Cidade/bairro registrado!",
    telefone: "✅ Telefone registrado!",
    email: "✅ E-mail registrado!",
    cnh: "✅ CNH registrada!",
    escolaridade_nivel: "✅ Escolaridade registrada!",
    escolaridade_curso: "✅ Curso registrado!",
    exp_empresa: "✅ Empresa registrada!",
    exp_cargo: "✅ Cargo registrado!",
    exp_periodo: "✅ Período registrado!",
    exp_atividades: "✅ Atividades registradas!",
    cursos: "✅ Cursos registrados!",
    objetivo: "✅ Objetivo registrado!",
  };
  return map[stepId] ?? null;
}

export function parseResumeData(raw: string): ResumeData {
  try {
    const parsed = JSON.parse(raw) as Partial<ResumeData>;
    return {
      nome: String(parsed.nome ?? "").trim(),
      idade: String(parsed.idade ?? "").trim(),
      estadoCivil: parsed.estadoCivil?.trim() || undefined,
      cidadeBairro: String(parsed.cidadeBairro ?? "").trim(),
      telefone: String(parsed.telefone ?? "").trim(),
      email: String(parsed.email ?? "").trim(),
      cnh: parsed.cnh?.trim() || undefined,
      escolaridadeNivel: String(parsed.escolaridadeNivel ?? "").trim(),
      escolaridadeCurso: String(parsed.escolaridadeCurso ?? "").trim(),
      experiencias: Array.isArray(parsed.experiencias) ? parsed.experiencias : [],
      cursos: parsed.cursos?.trim() || undefined,
      objetivo: parsed.objetivo?.trim() || undefined,
    };
  } catch {
    return {
      nome: "",
      idade: "",
      cidadeBairro: "",
      telefone: "",
      email: "",
      escolaridadeNivel: "",
      escolaridadeCurso: "",
      experiencias: [],
    };
  }
}

export function serializeResumeData(data: ResumeData): string {
  return JSON.stringify(data);
}

export function applyResumeReply(
  data: ResumeData,
  stepId: ResumeFlowStepId,
  reply: string,
  expDraft: Partial<ResumeExperience>,
): { data: ResumeData; expDraft: Partial<ResumeExperience> } {
  const text = reply.trim();
  const skip = isResumeSkipReply(text);
  const next = { ...data, experiencias: [...data.experiencias] };
  let draft = { ...expDraft };

  switch (stepId) {
    case "nome":
      next.nome = text;
      break;
    case "idade":
      next.idade = text;
      break;
    case "estado_civil":
      if (!skip) next.estadoCivil = text;
      break;
    case "cidade_bairro":
      next.cidadeBairro = text;
      break;
    case "telefone":
      next.telefone = text;
      break;
    case "email":
      next.email = text;
      break;
    case "cnh":
      if (!skip) next.cnh = text;
      break;
    case "escolaridade_nivel":
      next.escolaridadeNivel = text;
      break;
    case "escolaridade_curso":
      next.escolaridadeCurso = text;
      break;
    case "exp_empresa":
      draft = { empresa: text };
      break;
    case "exp_cargo":
      draft = { ...draft, cargo: text };
      break;
    case "exp_periodo":
      draft = { ...draft, periodo: text };
      break;
    case "exp_atividades":
      draft = { ...draft, atividades: text };
      if (draft.empresa && draft.cargo && draft.periodo && draft.atividades) {
        next.experiencias.push({
          empresa: draft.empresa,
          cargo: draft.cargo,
          periodo: draft.periodo,
          atividades: draft.atividades,
        });
        draft = {};
      }
      break;
    case "exp_mais": {
      const lower = text.toLowerCase();
      if (lower === "exp_sim" || lower.includes("sim")) draft = {};
      break;
    }
    case "cursos":
      if (!skip) next.cursos = text;
      break;
    case "objetivo":
      if (!skip) next.objetivo = text;
      break;
    default:
      break;
  }

  return { data: next, expDraft: draft };
}

export function resumeStepPrompt(config: ResumeFlowConfig, stepId: ResumeFlowStepId): string {
  if (stepId === "welcome") return config.welcomeMessage?.trim() || DEFAULT_WELCOME;
  return getResumeFlowStep(stepId)?.prompt ?? "";
}

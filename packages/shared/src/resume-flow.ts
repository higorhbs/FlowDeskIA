export const DEFAULT_RESUME_DOCUMENT_LABEL = "documento";

export const DEFAULT_RESUME_FLOW_KEYWORDS = [
  "documento",
  "gerar documento",
  "criar documento",
  "montar documento",
  "pdf",
  "formulario",
  "formulário",
];

export const DEFAULT_RESUME_EDIT_KEYWORDS = [
  "editar documento",
  "corrigir documento",
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
  "Vou coletar suas informações passo a passo para gerar seu *{documento}* em PDF.\n\n• Dados pessoais\n• Escolaridade\n• Experiência profissional\n• Cursos (se tiver)\n• Objetivo profissional (opcional)\n\nSe não tiver algum dado, responda *pular*.\n\nAntes de gerar, você poderá *revisar e editar* tudo.\n\nVamos começar?";

const DEFAULT_SUCCESS =
  "Pronto, {nome}! Seus dados foram registrados e o {documento} em PDF foi enviado para nossa equipe.\n\nPara corrigir algo, digite *editar {documento}*.";

export const RESUME_FLOW_STEPS: ResumeFlowStep[] = [
  { id: "welcome", prompt: DEFAULT_WELCOME },
  { id: "nome", prompt: "Qual seu *nome completo*?" },
  { id: "idade", prompt: "Qual sua *idade* ou *data de nascimento*?" },
  { id: "estado_civil", prompt: "Qual seu *estado civil*? _(opcional — responda pular)_", optional: true },
  { id: "cidade_bairro", prompt: "Em qual *cidade e bairro* você mora?" },
  { id: "telefone", prompt: "Qual seu *telefone* (WhatsApp)?" },
  { id: "email", prompt: "Qual seu *e-mail*?" },
  { id: "cnh", prompt: "Possui *CNH*? Se sim, informe a categoria. _(opcional — responda pular)_", optional: true },
  { id: "escolaridade_nivel", prompt: "Qual seu *nível de ensino*? _(fundamental, médio, técnico ou superior)_" },
  {
    id: "escolaridade_curso",
    prompt: "Qual *curso* e situação? _(ex: Administração — completo / em andamento)_",
  },
  { id: "exp_empresa", prompt: "Informe o *nome da empresa* ou tipo de trabalho:" },
  { id: "exp_cargo", prompt: "Qual *cargo ou função* você exercia?" },
  { id: "exp_periodo", prompt: "Qual o *período* de trabalho? _(ex: 2022 a 2024)_" },
  { id: "exp_atividades", prompt: "Quais as *principais atividades* realizadas?" },
  {
    id: "exp_mais",
    prompt: "Deseja adicionar *outra experiência profissional*?",
    buttons: [
      { id: "exp_sim", label: "Sim, adicionar" },
      { id: "exp_nao", label: "Não, continuar" },
    ],
  },
  { id: "cursos", prompt: "Tem *cursos ou qualificações*? _(opcional — responda pular)_", optional: true },
  { id: "objetivo", prompt: "Qual seu *objetivo profissional*? _(opcional — responda pular)_", optional: true },
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

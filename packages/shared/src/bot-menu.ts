export type BotMenuAction = "APPOINTMENT" | "CATALOG" | "FAQ" | "HUMAN" | "EXIT";

export interface BotMenuEntry {
  num: number;
  action: BotMenuAction;
  label: string;
}

const MENU_ENTRIES: Omit<BotMenuEntry, "num">[] = [
  { action: "APPOINTMENT", label: "Agendamentos" },
  { action: "CATALOG", label: "Catálogo" },
  { action: "FAQ", label: "FAQ" },
  { action: "HUMAN", label: "Falar com atendente" },
];

export function buildBotMenuEntries(): BotMenuEntry[] {
  return MENU_ENTRIES.map((e, i) => ({ num: i + 1, ...e }));
}

export function formatBotMenuText(businessName: string): string {
  const entries = buildBotMenuEntries();
  let text = `*Menu — ${businessName}*\n\n`;
  for (const e of entries) {
    text += `*${e.num}* — ${e.label}\n`;
  }
  text += `\n*0* — Sair\n\n`;
  text += `_Digite o número da opção desejada_`;
  return text;
}

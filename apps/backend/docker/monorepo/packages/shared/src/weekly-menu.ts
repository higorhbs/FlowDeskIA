// ─── Types ───────────────────────────────────────────────────────────────────

export type DayOfWeek =
  | "monday" | "tuesday" | "wednesday" | "thursday"
  | "friday" | "saturday" | "sunday";

export interface WeeklyMenuItem {
  id: string;
  name: string;
  description?: string;
  price?: number;
  category?: string;
  isDailySpecial?: boolean;
}

export interface DailyMenu {
  day: DayOfWeek;
  items: WeeklyMenuItem[];
  note?: string;
}

export interface WeeklyMenuConfig {
  enabled: boolean;
  triggerKeywords: string[];
  days: DailyMenu[];
  responsePrefix?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const DAY_OF_WEEK_LABELS: Record<DayOfWeek, string> = {
  monday: "Segunda-feira",
  tuesday: "Terça-feira",
  wednesday: "Quarta-feira",
  thursday: "Quinta-feira",
  friday: "Sexta-feira",
  saturday: "Sábado",
  sunday: "Domingo",
};

export const DAY_OF_WEEK_SHORT: Record<DayOfWeek, string> = {
  monday: "Seg",
  tuesday: "Ter",
  wednesday: "Qua",
  thursday: "Qui",
  friday: "Sex",
  saturday: "Sáb",
  sunday: "Dom",
};

export const ALL_DAYS: DayOfWeek[] = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
];

export const DEFAULT_WEEKLY_MENU_KEYWORDS = [
  "cardápio",
  "cardapio",
  "o que tem hoje",
  "menu do dia",
  "prato do dia",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getTodayDayOfWeek(timezone?: string): DayOfWeek {
  const days: DayOfWeek[] = [
    "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
  ];
  if (timezone) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "long",
      }).formatToParts(new Date());
      const weekday = parts.find((p) => p.type === "weekday")?.value?.toLowerCase();
      const map: Record<string, DayOfWeek> = {
        sunday: "sunday", monday: "monday", tuesday: "tuesday",
        wednesday: "wednesday", thursday: "thursday", friday: "friday", saturday: "saturday",
      };
      if (weekday && weekday in map) return map[weekday]!;
    } catch {
      // fall through
    }
  }
  return days[new Date().getDay()]!;
}

export function isWeeklyMenuTrigger(text: string, menu: WeeklyMenuConfig): boolean {
  const normalized = text.toLowerCase().trim();
  const keywords =
    menu.triggerKeywords?.length > 0 ? menu.triggerKeywords : DEFAULT_WEEKLY_MENU_KEYWORDS;
  return keywords.some((kw) => {
    const k = kw.toLowerCase().trim();
    return k.length > 0 && normalized.includes(k);
  });
}

export interface OrderMenuEntry {
  num: number;
  item: WeeklyMenuItem;
}

/** Lista numerada dos itens do dia (prato do dia primeiro) — usada pelo fluxo de pedido guiado. */
export function buildOrderMenuForDay(config: WeeklyMenuConfig, day: DayOfWeek): OrderMenuEntry[] {
  const dailyMenu = config.days.find((d) => d.day === day);
  if (!dailyMenu) return [];
  const items = [...dailyMenu.items].sort(
    (a, b) => Number(b.isDailySpecial) - Number(a.isDailySpecial),
  );
  return items.map((item, i) => ({ num: i + 1, item }));
}

export function formatOrderMenuMessage(
  entries: OrderMenuEntry[],
  businessName: string,
  dayOfWeek: DayOfWeek,
): string {
  const dayLabel = DAY_OF_WEEK_LABELS[dayOfWeek];
  if (!entries.length) {
    return `🍽️ *Cardápio de ${dayLabel} — ${businessName}*\n\n_Não há itens no cardápio para hoje._`;
  }
  let text = `🍽️ *Cardápio de ${dayLabel} — ${businessName}*\n\n`;
  for (const { num, item } of entries) {
    text += `*${num}* — ${item.isDailySpecial ? "⭐ " : ""}${item.name}`;
    if (item.price != null && item.price > 0) {
      text += ` — *R$ ${item.price.toFixed(2).replace(".", ",")}*`;
    }
    text += "\n";
  }
  return text.trim();
}

export interface OrderMenuListRow {
  id: string;
  title: string;
  description?: string;
}

export interface OrderMenuListSection {
  title?: string;
  rows: OrderMenuListRow[];
}

const ORDER_LIST_MAX_ROWS_PER_SECTION = 10;
const ORDER_LIST_MAX_TOTAL_ROWS = 24;

/** Agrupa os itens do dia em seções de lista (WhatsApp list message) — usada pelo fluxo de pedido guiado. */
export function buildOrderMenuListSections(entries: OrderMenuEntry[]): OrderMenuListSection[] {
  const categories = new Map<string, OrderMenuEntry[]>();
  for (const entry of entries) {
    const cat = entry.item.category?.trim() || "";
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(entry);
  }
  const hasCategories = [...categories.keys()].some((k) => k !== "");

  const sections: OrderMenuListSection[] = [];
  let totalRows = 0;
  for (const [category, items] of categories) {
    if (totalRows >= ORDER_LIST_MAX_TOTAL_ROWS) break;
    const remaining = ORDER_LIST_MAX_TOTAL_ROWS - totalRows;
    const rows: OrderMenuListRow[] = items
      .slice(0, Math.min(ORDER_LIST_MAX_ROWS_PER_SECTION, remaining))
      .map(({ num, item }) => ({
        id: String(num),
        title: `${item.isDailySpecial ? "⭐ " : ""}${item.name}`,
        description:
          item.price != null && item.price > 0
            ? `R$ ${item.price.toFixed(2).replace(".", ",")}`
            : undefined,
      }));
    if (!rows.length) continue;
    totalRows += rows.length;
    sections.push({ title: hasCategories && category ? category : undefined, rows });
  }
  return sections;
}

export function formatWeeklyMenuResponse(
  menu: WeeklyMenuConfig,
  dayOfWeek: DayOfWeek,
  businessName: string,
): string {
  const dailyMenu = menu.days.find((d) => d.day === dayOfWeek);
  const dayLabel = DAY_OF_WEEK_LABELS[dayOfWeek];

  if (!dailyMenu || dailyMenu.items.length === 0) {
    return `🍽️ *Cardápio de ${dayLabel} — ${businessName}*\n\n_Não há itens no cardápio para hoje._`;
  }

  let text = `🍽️ *Cardápio de ${dayLabel} — ${businessName}*\n\n`;

  const categories = new Map<string, WeeklyMenuItem[]>();
  for (const item of dailyMenu.items) {
    const cat = item.category?.trim() || "";
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(item);
  }
  for (const items of categories.values()) {
    items.sort((a, b) => Number(b.isDailySpecial) - Number(a.isDailySpecial));
  }

  const hasCategories = [...categories.keys()].some((k) => k !== "");

  for (const [category, items] of categories) {
    if (hasCategories && category) {
      text += `*${category}*\n`;
    }
    for (const item of items) {
      text += `• ${item.isDailySpecial ? "⭐ " : ""}*${item.name}*`;
      if (item.isDailySpecial) text += " _(Prato do dia)_";
      if (item.description) text += ` — ${item.description}`;
      if (item.price != null && item.price > 0) {
        text += ` — *R$ ${item.price.toFixed(2).replace(".", ",")}*`;
      }
      text += "\n";
    }
    text += "\n";
  }

  if (dailyMenu.note?.trim()) {
    text += `_${dailyMenu.note.trim()}_\n`;
  }

  if (menu.responsePrefix?.trim()) {
    text = `${menu.responsePrefix.trim()}\n\n${text}`;
  }

  return text.trim();
}

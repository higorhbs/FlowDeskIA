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
  return menu.triggerKeywords.some((kw) => normalized.includes(kw.toLowerCase().trim()));
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

  const hasCategories = [...categories.keys()].some((k) => k !== "");

  for (const [category, items] of categories) {
    if (hasCategories && category) {
      text += `*${category}*\n`;
    }
    for (const item of items) {
      text += `• *${item.name}*`;
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

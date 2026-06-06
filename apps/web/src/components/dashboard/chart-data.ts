const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function weekConversationsData(byDay: number[] | undefined) {
  return WEEK_DAYS.map((day, i) => ({
    day,
    conversas: byDay?.[i] ?? 0,
  }));
}

export function monthConversationsData(byDay: number[] | undefined, ref: Date) {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => ({
    date: new Date(y, m, i + 1).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    }),
    conversas: byDay?.[i] ?? 0,
  }));
}

export function monthTitle(ref: Date) {
  return ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function conversationsTotal(data: { conversas: number }[]) {
  return data.reduce((sum, item) => sum + item.conversas, 0);
}

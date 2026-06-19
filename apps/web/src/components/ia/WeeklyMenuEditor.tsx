"use client";

import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { businessApi } from "@/lib/api";
import { toast } from "sonner";
import {
  Plus, Trash2, Loader2, X, Save, Pencil, Check,
  GripVertical, ChevronDown, ChevronRight, Utensils,
  Hash, Info, DollarSign, Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  ALL_DAYS,
  DAY_OF_WEEK_LABELS,
  DEFAULT_WEEKLY_MENU_KEYWORDS,
  type DayOfWeek,
  type WeeklyMenuConfig,
  type WeeklyMenuItem,
  type DailyMenu,
} from "@flowdesk/shared";

function nanoid() {
  return Math.random().toString(36).slice(2, 10);
}

const DAY_COLORS: Record<DayOfWeek, { bg: string; border: string; accent: string; badge: string }> = {
  monday:    { bg: "bg-violet-50",  border: "border-violet-200", accent: "bg-violet-600",  badge: "bg-violet-100 text-violet-700" },
  tuesday:   { bg: "bg-blue-50",    border: "border-blue-200",   accent: "bg-blue-600",    badge: "bg-blue-100 text-blue-700" },
  wednesday: { bg: "bg-cyan-50",    border: "border-cyan-200",   accent: "bg-cyan-600",    badge: "bg-cyan-100 text-cyan-700" },
  thursday:  { bg: "bg-emerald-50", border: "border-emerald-200",accent: "bg-emerald-600", badge: "bg-emerald-100 text-emerald-700" },
  friday:    { bg: "bg-amber-50",   border: "border-amber-200",  accent: "bg-amber-600",   badge: "bg-amber-100 text-amber-700" },
  saturday:  { bg: "bg-orange-50",  border: "border-orange-200", accent: "bg-orange-600",  badge: "bg-orange-100 text-orange-700" },
  sunday:    { bg: "bg-rose-50",    border: "border-rose-200",   accent: "bg-rose-600",    badge: "bg-rose-100 text-rose-700" },
};

function buildDefaultDays(): DailyMenu[] {
  return ALL_DAYS.map((day) => ({ day, items: [] }));
}

function mergeDays(saved?: DailyMenu[]): DailyMenu[] {
  return ALL_DAYS.map((day) => {
    const found = saved?.find((d) => d.day === day);
    return found ?? { day, items: [] };
  });
}

interface ItemModalState {
  open: boolean;
  dayIndex: number | null;
  itemIndex: number | null;
  name: string;
  description: string;
  price: string;
  category: string;
}

const EMPTY_MODAL: ItemModalState = {
  open: false, dayIndex: null, itemIndex: null,
  name: "", description: "", price: "", category: "",
};

// ── Item drag state ────────────────────────────────────────────────────────────
interface DragState {
  fromDay: number;
  fromItem: number;
}

export function WeeklyMenuEditor({
  businessId,
  businessName,
  initialConfig,
}: {
  businessId: string;
  businessName: string;
  initialConfig?: WeeklyMenuConfig;
}) {
  const queryClient = useQueryClient();

  const [enabled, setEnabled] = useState(initialConfig?.enabled ?? false);
  const [keywords, setKeywords] = useState<string>(
    (initialConfig?.triggerKeywords ?? DEFAULT_WEEKLY_MENU_KEYWORDS).join(", ")
  );
  const [responsePrefix, setResponsePrefix] = useState(initialConfig?.responsePrefix ?? "");
  const [days, setDays] = useState<DailyMenu[]>(() => mergeDays(initialConfig?.days));
  const [collapsed, setCollapsed] = useState<Record<DayOfWeek, boolean>>({} as any);
  const [modal, setModal] = useState<ItemModalState>(EMPTY_MODAL);

  // Drag & drop state
  const dragRef = useRef<DragState | null>(null);
  const [dragOver, setDragOver] = useState<{ dayIndex: number; itemIndex: number } | null>(null);

  const saveMutation = useMutation({
    mutationFn: () => {
      const config: WeeklyMenuConfig = {
        enabled,
        triggerKeywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
        days,
        responsePrefix: responsePrefix.trim() || undefined,
      };
      return businessApi.update(businessId, { weeklyMenu: config } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business", businessId] });
      toast.success("Cardápio semanal salvo!");
    },
    onError: () => toast.error("Erro ao salvar cardápio"),
  });

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function toggleCollapse(day: DayOfWeek) {
    setCollapsed((prev) => ({ ...prev, [day]: !prev[day] }));
  }

  function openCreate(dayIndex: number) {
    setModal({ ...EMPTY_MODAL, open: true, dayIndex });
  }

  function openEdit(dayIndex: number, itemIndex: number) {
    const item = days[dayIndex]!.items[itemIndex]!;
    setModal({
      open: true,
      dayIndex,
      itemIndex,
      name: item.name,
      description: item.description ?? "",
      price: item.price != null ? String(item.price) : "",
      category: item.category ?? "",
    });
  }

  function closeModal() {
    setModal(EMPTY_MODAL);
  }

  function commitModal() {
    const name = modal.name.trim();
    if (!name) { toast.error("Informe o nome do prato"); return; }
    const price = modal.price.trim().replace(",", ".");
    const priceNum = price ? parseFloat(price) : undefined;
    const item: WeeklyMenuItem = {
      id: nanoid(),
      name,
      description: modal.description.trim() || undefined,
      price: priceNum != null && !isNaN(priceNum) ? priceNum : undefined,
      category: modal.category.trim() || undefined,
    };

    setDays((prev) => {
      const next = prev.map((d) => ({ ...d, items: [...d.items] }));
      const dayData = next[modal.dayIndex!]!;
      if (modal.itemIndex !== null) {
        dayData.items[modal.itemIndex] = { ...dayData.items[modal.itemIndex], ...item };
      } else {
        dayData.items.push(item);
      }
      return next;
    });
    closeModal();
  }

  function removeItem(dayIndex: number, itemIndex: number) {
    setDays((prev) => {
      const next = prev.map((d) => ({ ...d, items: [...d.items] }));
      next[dayIndex]!.items.splice(itemIndex, 1);
      return next;
    });
  }

  function updateNote(dayIndex: number, note: string) {
    setDays((prev) => {
      const next = prev.map((d) => ({ ...d }));
      next[dayIndex] = { ...next[dayIndex]!, note };
      return next;
    });
  }

  // ── Drag handlers ────────────────────────────────────────────────────────────

  function onDragStart(fromDay: number, fromItem: number) {
    dragRef.current = { fromDay, fromItem };
  }

  function onDragOverItem(e: React.DragEvent, dayIndex: number, itemIndex: number) {
    e.preventDefault();
    setDragOver({ dayIndex, itemIndex });
  }

  function onDragOverDay(e: React.DragEvent, dayIndex: number) {
    e.preventDefault();
    setDragOver({ dayIndex, itemIndex: days[dayIndex]!.items.length });
  }

  function onDrop(e: React.DragEvent, toDay: number, toItem: number) {
    e.preventDefault();
    const drag = dragRef.current;
    setDragOver(null);
    if (!drag) return;
    const { fromDay, fromItem } = drag;
    dragRef.current = null;

    if (fromDay === toDay && fromItem === toItem) return;

    setDays((prev) => {
      const next = prev.map((d) => ({ ...d, items: [...d.items] }));
      const moved = next[fromDay]!.items.splice(fromItem, 1)[0];
      if (!moved) return prev;

      let insertAt = toItem;
      if (fromDay === toDay && fromItem < toItem) insertAt--;
      insertAt = Math.max(0, Math.min(insertAt, next[toDay]!.items.length));
      next[toDay]!.items.splice(insertAt, 0, moved);
      return next;
    });
  }

  function onDragEnd() {
    dragRef.current = null;
    setDragOver(null);
  }

  function copyDayToAll(fromIndex: number) {
    const source = days[fromIndex]!;
    if (!source.items.length) return;
    setDays((prev) =>
      prev.map((d, i) =>
        i === fromIndex
          ? d
          : { ...d, items: source.items.map((it) => ({ ...it, id: nanoid() })) }
      )
    );
    toast.success(`Cardápio de ${DAY_OF_WEEK_LABELS[source.day]} copiado para todos os dias`);
  }

  function clearDay(dayIndex: number) {
    setDays((prev) =>
      prev.map((d, i) => (i === dayIndex ? { ...d, items: [], note: undefined } : d))
    );
  }

  // ── Preview of bot response ─────────────────────────────────────────────────

  const today = new Date();
  const jsDay = today.getDay();
  const todayDow: DayOfWeek = (["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as DayOfWeek[])[jsDay]!;
  const todayDayIndex = ALL_DAYS.indexOf(todayDow);

  return (
    <div className="space-y-8">
      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-xl">
                  🍽️
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">
                    {modal.itemIndex !== null ? "Editar item" : "Novo item do cardápio"}
                  </h3>
                  <p className="text-orange-100 text-xs mt-0.5">
                    {modal.dayIndex !== null ? DAY_OF_WEEK_LABELS[days[modal.dayIndex!]!.day] : ""}
                  </p>
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" onClick={closeModal}
                className="rounded-xl bg-white/20 hover:bg-white/30 text-white">
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <span className="flex items-center gap-1.5"><Utensils className="w-3.5 h-3.5 text-orange-500" /> Nome do prato *</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  value={modal.name}
                  onChange={(e) => setModal((m) => ({ ...m, name: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") commitModal(); if (e.key === "Escape") closeModal(); }}
                  placeholder="Ex: Frango grelhado com arroz"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <span className="flex items-center gap-1.5"><Info className="w-3.5 h-3.5 text-blue-500" /> Descrição <span className="font-normal text-gray-400">(opcional)</span></span>
                </label>
                <input
                  type="text"
                  value={modal.description}
                  onChange={(e) => setModal((m) => ({ ...m, description: e.target.value }))}
                  placeholder="Ex: Acompanha salada e suco"
                  className="input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-emerald-500" /> Preço (R$) <span className="font-normal text-gray-400">(opcional)</span></span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={modal.price}
                    onChange={(e) => setModal((m) => ({ ...m, price: e.target.value }))}
                    placeholder="Ex: 25,90"
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    <span className="flex items-center gap-1.5"><Tag className="w-3.5 h-3.5 text-purple-500" /> Categoria <span className="font-normal text-gray-400">(opcional)</span></span>
                  </label>
                  <input
                    type="text"
                    value={modal.category}
                    onChange={(e) => setModal((m) => ({ ...m, category: e.target.value }))}
                    placeholder="Ex: Pratos, Bebidas, Sobremesas"
                    className="input"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={closeModal}>Cancelar</Button>
                <Button type="button" className="flex-1 bg-orange-500 hover:bg-orange-600" disabled={!modal.name.trim()} onClick={commitModal}>
                  <Check className="w-4 h-4" />
                  {modal.itemIndex !== null ? "Salvar alterações" : "Adicionar"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Config header */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-900">Cardápio semanal ativo</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Quando ativado, o bot responde com o cardápio do dia ao detectar as palavras-chave.
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} className="mt-0.5" />
        </div>

        {enabled && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-brand-500" />
                  Palavras-chave que disparam o cardápio
                  <span className="font-normal text-gray-400">(separadas por vírgula)</span>
                </span>
              </label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="cardápio, o que tem hoje, menu do dia, prato do dia"
                className="input"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                Quando o cliente enviar uma dessas palavras, o bot responde com o cardápio do dia automaticamente.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Mensagem antes do cardápio
                <span className="ml-1 font-normal text-gray-400">(opcional)</span>
              </label>
              <input
                type="text"
                value={responsePrefix}
                onChange={(e) => setResponsePrefix(e.target.value)}
                placeholder="Ex: Olá! Confira nosso cardápio de hoje 😊"
                className="input"
              />
            </div>
          </>
        )}
      </div>

      {enabled && (
        <>
          {/* Instruction banner */}
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
            <span className="text-lg flex-shrink-0 mt-0.5">💡</span>
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong>Arraste</strong> os itens entre os dias para reorganizar o cardápio. Clique em <strong>"+ Adicionar prato"</strong> para incluir um novo item.
              Use <strong>"Copiar para todos"</strong> quando o cardápio for igual em vários dias.
            </p>
          </div>

          {/* Weekly grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {days.map((daily, dayIndex) => {
              const colors = DAY_COLORS[daily.day];
              const isToday = dayIndex === todayDayIndex;
              const isOpen = !collapsed[daily.day];

              return (
                <div
                  key={daily.day}
                  className={cn(
                    "rounded-2xl border-2 overflow-hidden transition-all",
                    colors.border,
                    colors.bg,
                    isToday && "ring-2 ring-offset-2 ring-brand-400"
                  )}
                  onDragOver={(e) => onDragOverDay(e, dayIndex)}
                  onDrop={(e) => onDrop(e, dayIndex, daily.items.length)}
                >
                  {/* Day header */}
                  <div className={cn("px-3 py-2.5 flex items-center justify-between", colors.accent)}>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleCollapse(daily.day)}
                        className="flex items-center gap-2 text-white"
                      >
                        <span className="font-bold text-sm">{DAY_OF_WEEK_LABELS[daily.day]}</span>
                        {isOpen ? (
                          <ChevronDown className="w-3.5 h-3.5 opacity-80" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 opacity-80" />
                        )}
                      </button>
                      {isToday && (
                        <span className="text-[10px] font-semibold bg-white/25 text-white px-2 py-0.5 rounded-full">
                          Hoje
                        </span>
                      )}
                    </div>
                    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full bg-white/20 text-white")}>
                      {daily.items.length} {daily.items.length === 1 ? "item" : "itens"}
                    </span>
                  </div>

                  {/* Items */}
                  {isOpen && (
                    <div className="p-2 space-y-1.5 min-h-[48px]">
                      {daily.items.length === 0 && (
                        <div
                          className="text-center text-xs text-gray-400 py-4 border-2 border-dashed border-gray-200 rounded-xl"
                          onDragOver={(e) => { e.preventDefault(); setDragOver({ dayIndex, itemIndex: 0 }); }}
                          onDrop={(e) => onDrop(e, dayIndex, 0)}
                        >
                          Sem pratos — arraste aqui ou adicione
                        </div>
                      )}

                      {daily.items.map((item, itemIndex) => {
                        const isDropTarget = dragOver?.dayIndex === dayIndex && dragOver.itemIndex === itemIndex;
                        return (
                          <div key={item.id}>
                            {isDropTarget && (
                              <div className="h-1.5 rounded-full bg-brand-400 opacity-60 mb-1" />
                            )}
                            <div
                              draggable
                              onDragStart={() => onDragStart(dayIndex, itemIndex)}
                              onDragOver={(e) => onDragOverItem(e, dayIndex, itemIndex)}
                              onDrop={(e) => onDrop(e, dayIndex, itemIndex)}
                              onDragEnd={onDragEnd}
                              className="group flex items-center gap-2 bg-white rounded-xl px-2.5 py-2 shadow-sm border border-gray-100 hover:border-gray-300 cursor-grab active:cursor-grabbing transition-all hover:shadow-md"
                            >
                              <GripVertical className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 group-hover:text-gray-500" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-gray-800 truncate">{item.name}</p>
                                {item.description && (
                                  <p className="text-[11px] text-gray-400 truncate">{item.description}</p>
                                )}
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  {item.price != null && item.price > 0 && (
                                    <span className="text-[10px] font-semibold text-emerald-600">
                                      R$ {item.price.toFixed(2).replace(".", ",")}
                                    </span>
                                  )}
                                  {item.category && (
                                    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-md", colors.badge)}>
                                      {item.category}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                <Button
                                  type="button" variant="ghost" size="icon-xs"
                                  onClick={() => openEdit(dayIndex, itemIndex)}
                                  className="text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg"
                                >
                                  <Pencil className="w-3 h-3" />
                                </Button>
                                <Button
                                  type="button" variant="ghost" size="icon-xs"
                                  onClick={() => removeItem(dayIndex, itemIndex)}
                                  className="text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Drop zone at the end */}
                      {dragOver?.dayIndex === dayIndex && dragOver.itemIndex === daily.items.length && daily.items.length > 0 && (
                        <div className="h-1.5 rounded-full bg-brand-400 opacity-60" />
                      )}

                      {/* Note */}
                      <div className="mt-2">
                        <input
                          type="text"
                          value={daily.note ?? ""}
                          onChange={(e) => updateNote(dayIndex, e.target.value)}
                          placeholder="Observação do dia (opcional)"
                          className="w-full text-[11px] px-2.5 py-1.5 rounded-lg border border-dashed border-gray-200 bg-white/60 text-gray-500 placeholder-gray-300 focus:outline-none focus:border-brand-300 focus:bg-white"
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1 mt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => openCreate(dayIndex)}
                          className="flex-1 h-auto py-1.5 text-[11px] text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-xl border border-dashed border-gray-200 hover:border-brand-300 gap-1"
                        >
                          <Plus className="w-3 h-3" /> Adicionar prato
                        </Button>
                      </div>

                      {daily.items.length > 0 && (
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => copyDayToAll(dayIndex)}
                            title="Copiar este cardápio para todos os outros dias"
                            className="flex-1 h-auto py-1 text-[10px] text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg gap-1"
                          >
                            📋 Copiar para todos
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => clearDay(dayIndex)}
                            title="Limpar este dia"
                            className="h-auto py-1 px-2 text-[10px] text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bot preview */}
          <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-sm">💬</div>
              <p className="text-sm font-semibold text-gray-800">Prévia da resposta do bot — hoje ({DAY_OF_WEEK_LABELS[todayDow]})</p>
            </div>
            <div className="bg-[#DCF8C6] rounded-2xl rounded-tr-sm px-4 py-3 max-w-xs shadow-sm">
              {(() => {
                const todayMenu = days[todayDayIndex];
                const prefix = responsePrefix.trim();
                const lines: string[] = [];
                if (prefix) lines.push(prefix, "");
                lines.push(`🍽️ *Cardápio de ${DAY_OF_WEEK_LABELS[todayDow]} — ${businessName}*`, "");
                if (!todayMenu || todayMenu.items.length === 0) {
                  lines.push("_Não há itens no cardápio para hoje._");
                } else {
                  for (const item of todayMenu.items) {
                    let line = `• *${item.name}*`;
                    if (item.description) line += ` — ${item.description}`;
                    if (item.price != null && item.price > 0) line += ` — *R$ ${item.price.toFixed(2).replace(".", ",")}*`;
                    lines.push(line);
                  }
                  if (todayMenu.note?.trim()) {
                    lines.push("", `_${todayMenu.note.trim()}_`);
                  }
                }
                return lines.map((line, i) => (
                  <p key={i} className={cn("text-xs leading-relaxed", !line && "h-2")}>
                    {line ? (
                      <WaInline text={line} />
                    ) : null}
                  </p>
                ));
              })()}
            </div>
          </div>
        </>
      )}

      {/* Save button */}
      <Button
        type="button"
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="shadow-sm"
      >
        {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Salvar cardápio
      </Button>
    </div>
  );
}

function WaInline({ text }: { text: string }) {
  const tokens = text.split(/(\*[^*]+\*|_[^_]+_)/g);
  return (
    <>
      {tokens.map((t, i) => {
        if (t.startsWith("*") && t.endsWith("*"))
          return <strong key={i} className="font-semibold">{t.slice(1, -1)}</strong>;
        if (t.startsWith("_") && t.endsWith("_"))
          return <em key={i} className="italic text-gray-500">{t.slice(1, -1)}</em>;
        return <span key={i}>{t}</span>;
      })}
    </>
  );
}

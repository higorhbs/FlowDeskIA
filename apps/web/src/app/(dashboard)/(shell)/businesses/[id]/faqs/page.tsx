"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAppRouter } from "@/lib/app-navigation";
import { panelHref } from "@/lib/business-nav";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { businessApi, faqApi } from "@/lib/api";
import { tenantApi } from "@/lib/api";
import { useBusinessId } from "@/lib/use-business-id";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  MessageSquare, HelpCircle, Plus, Trash2, Loader2, X,
  ChevronUp, ChevronDown, Eye, Save, Pencil, Check,
  Sparkles, Hash, MessageCircleQuestion, Zap, GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { BotMenuItemConfig } from "@flowdesk/firebase/client";
import { buildBotMenuEntries, getBusinessVocabulary, renderTemplate, DEFAULT_THANKS_MSG } from "@flowdesk/shared";
import { IaIcon } from "@/lib/ia-brand";
import { usePlanAllowsPix } from "@/lib/use-plan-allows-pix";
import { LeadFlowEditor } from "@/components/ia/LeadFlowEditor";

const LEGACY_EMOJI: Record<string, string> = {
  APPOINTMENT: "📅",
  CATALOG: "🛍️",
  PAYMENT: "💳",
  FAQ: "❓",
  HUMAN: "👤",
};

function legacyMenuResponse(type: string | undefined, action: string): string {
  const v = getBusinessVocabulary(type);
  const map: Record<string, string> = {
    APPOINTMENT: v.botLegacyAppointmentHint,
    CATALOG: v.botLegacyCatalogHint,
    PAYMENT: "Qual o valor? (ex: *50* ou *150,00*)",
    FAQ: "Envie sua dúvida em texto ou digite *dúvida* para ver as perguntas frequentes.",
    HUMAN: "Certo! Vou chamar um atendente. Aguarde um momento... 👤",
  };
  return map[action] ?? "";
}

function defaultMenuItems(type?: string, plan?: string): BotMenuItemConfig[] {
  return buildBotMenuEntries(type, plan).map((e, index) => ({
    num: e.num,
    label: e.label,
    response: legacyMenuResponse(type, e.action),
    enabled: true,
    emoji: LEGACY_EMOJI[e.action],
  }));
}

function migrateMenuItem(
  raw: Partial<BotMenuItemConfig> & { action?: string },
  index: number,
  businessType?: string
): BotMenuItemConfig {
  const response =
    raw.response?.trim() ||
    (raw.action ? legacyMenuResponse(businessType, raw.action) : "") ||
    "";
  const emoji =
    raw.emoji ||
    (raw.action ? LEGACY_EMOJI[raw.action] : undefined);
  return {
    num: index + 1,
    label: raw.label?.trim() || `Opção ${index + 1}`,
    response,
    enabled: raw.enabled !== false,
    emoji,
  };
}

function migrateMenu(saved?: Partial<BotMenuItemConfig>[], businessType?: string, plan?: string): BotMenuItemConfig[] {
  const entries = !saved?.length ? defaultMenuItems(businessType, plan) : saved.map((raw, i) => migrateMenuItem(raw, i, businessType));
  if (plan === "PRO" || plan === "UNLIMITED") return entries;
  return entries.filter((item) => item.action !== "PAYMENT" && !/pix|pagar|pagamento|sinal/i.test(`${item.label} ${item.response ?? ""}`));
}

const faqSchema = z.object({
  question: z.string().min(5, "Pergunta muito curta"),
  answer:   z.string().min(5, "Resposta muito curta"),
  keywords: z.string().min(1, "Informe pelo menos uma palavra-chave"),
});
type FAQForm = z.infer<typeof faqSchema>;

type Tab = "menu" | "faqs" | "leadflow";
type PreviewFocus = "greeting" | "menu" | "thanks" | "attendant";

// ── Emoji picker ───────────────────────────────────────────────────────────────
const EMOJI_CATS = [
  { icon: "⭐", label: "Populares",  emojis: ["⭐","✅","🎯","💬","📢","🔥","💡","🏆","👏","🙏","💯","🎉","✨","⚡","🆕","❤️","😊","👍","🤩","😍","🥰","😎","🤝","💪","🙌","🫶","💥","🌟","🎊","🎈","🎀","🪄","🎗️","🏅","🥇","🌈"] },
  { icon: "💼", label: "Negócios",  emojis: ["📅","📋","📌","🛍️","💰","💳","🏪","🏬","📦","🚚","✉️","📞","💼","🤝","📊","🗓️","🧾","💹","🏷️","🪙","💵","💸","📈","📉","🏦","🏧","🖨️","🖥️","📱","💻","🖱️","⌨️","🗃️","📁","📂","🗄️","📬","📮","📯"] },
  { icon: "🧑", label: "Serviços",  emojis: ["👤","👥","💇","💈","✂️","🦷","🩺","🧑‍🍳","👨‍⚕️","🧑‍🔧","💆","🧴","💅","🪒","🏋️","🧹","🪑","🛁","🛒","🧺","🪣","🧽","🪠","🧲","🔧","🪛","🔨","⚙️","🩹","💊","🩻","🔬","🧪","🧬","🏥","🏫","🏗️","🏠","🏡"] },
  { icon: "🍽️", label: "Comida",    emojis: ["🍕","🍔","🍣","🌮","🍝","🍰","☕","🥤","🍺","🥗","🍱","🧁","🍦","🥐","🍳","🫖","🧃","🍷","🥩","🍗","🌭","🥪","🫔","🥫","🍜","🍲","🍛","🍤","🦐","🦀","🥚","🧀","🥞","🧇","🥓","🥨","🍞","🥖","🫓","🧆","🥙","🫕"] },
  { icon: "💡", label: "Símbolos",  emojis: ["❓","❗","ℹ️","🔔","🔍","🔑","🚪","⏰","📍","🗺️","🎫","♻️","✏️","📝","📣","🆘","🔒","🔓","🔕","💤","⛔","🚫","⚠️","✔️","❌","➕","➖","🔃","🔄","▶️","⏸️","⏹️","🔺","🔻","🔷","🔶","🔹","🔸","🟢","🔴","🟡","🟠","🟣","⚫","⚪"] },
] as const;

function EmojiPickerBalloon({
  anchor, onSelect, onClear, onClose,
}: {
  anchor: HTMLElement;
  onSelect: (e: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [cat, setCat] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: "hidden", position: "fixed", zIndex: 9999 });

  useEffect(() => {
    if (!anchor?.isConnected) return;
    const PICKER_W = 296, PICKER_H = 260;
    const rect = anchor.getBoundingClientRect();
    let left = rect.left, top = rect.bottom + 6;
    if (left + PICKER_W > window.innerWidth - 8) left = Math.max(8, rect.right - PICKER_W);
    if (top + PICKER_H > window.innerHeight - 8) top = rect.top - PICKER_H - 6;
    setStyle({ visibility: "visible", position: "fixed", zIndex: 9999, top, left });
  }, [anchor]);

  useEffect(() => {
    if (!anchor?.isConnected) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node) && !anchor.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [anchor, onClose]);

  return createPortal(
    <div ref={ref} style={style}
      className="w-[296px] rounded-2xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.18)] border border-gray-100 overflow-hidden"
    >
      <div className="flex items-center border-b border-gray-100 bg-gray-50 px-1.5 pt-1.5 gap-0.5">
        {EMOJI_CATS.map((c, ci) => (
          <Button key={ci} type="button" variant="ghost" onClick={() => setCat(ci)} title={c.label}
            className={cn(
              "flex-1 flex items-center justify-center py-1.5 text-[18px] rounded-t-lg h-auto min-w-0",
              cat === ci ? "bg-white border-b-2 border-brand-500 shadow-sm" : "hover:bg-white/70 text-gray-400"
            )}
          >{c.icon}</Button>
        ))}
        <Button type="button" variant="ghost" size="icon-xs" onClick={() => { onClear(); onClose(); }} title="Sem emoji"
          className="text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-t-lg"
        ><X className="w-3.5 h-3.5" /></Button>
      </div>
      <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
        {EMOJI_CATS[cat]!.label}
      </p>
      <div className="grid grid-cols-9 gap-0 px-1.5 pb-2 max-h-[176px] overflow-y-auto">
        {EMOJI_CATS[cat]!.emojis.map((emoji) => (
          <Button key={emoji} type="button" variant="ghost" size="icon-xs"
            onClick={() => { onSelect(emoji); onClose(); }}
            className="text-[18px] rounded-lg hover:bg-gray-100 active:scale-90"
          >{emoji}</Button>
        ))}
      </div>
    </div>,
    document.body
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
  onPreview,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  onPreview?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-white px-4 py-3.5",
        disabled && "opacity-50"
      )}
    >
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{hint}</p>
      </div>
      <div className="flex items-center gap-2">
        {onPreview && (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={onPreview}
            className="text-xs text-brand-700 hover:text-brand-900 border-brand-200 bg-brand-50 h-auto"
          >
            <Eye className="w-3.5 h-3.5" />
            Prévia
          </Button>
        )}
        <Switch
          checked={checked}
          disabled={disabled}
          onCheckedChange={onChange}
          className="mt-0.5"
        />
      </div>
    </div>
  );
}

const IA_TEMPLATE_VARS = [
  { token: "{nome}", label: "Nome do cliente" },
  { token: "{negocio}", label: "Nome do negócio" },
  { token: "{atendente}", label: "Nome do atendente" },
] as const;

function insertToken(text: string, token: string, start: number, end: number) {
  const from = Math.max(0, start);
  const to = Math.max(from, end);
  return `${text.slice(0, from)}${token}${text.slice(to)}`;
}

function TemplateVariableBar({
  onPick,
}: {
  onPick: (token: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {IA_TEMPLATE_VARS.map((v) => (
        <Button
          key={v.token}
          type="button"
          variant="outline"
          size="xs"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", v.token);
            e.dataTransfer.effectAllowed = "copy";
          }}
          onClick={() => onPick(v.token)}
          className="inline-flex items-center border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 h-auto"
          title={`${v.label} (${v.token})`}
        >
          {v.token}
        </Button>
      ))}
    </div>
  );
}

// ── BotMenuEditor ──────────────────────────────────────────────────────────────
function BotMenuEditor({
  businessId,
  initialMenu,
  businessName,
  businessType,
  initialGreetingMsg,
  initialMenuEnabled,
  initialGreetingEnabled,
  initialThanksMsg,
  initialThanksEnabled,
  initialAttendantName,
  initialAttendantNames,
  initialAttendantEnabled,
  initialManualAttendantPrefixEnabled,
  autoReplyEnabled,
}: {
  businessId: string;
  initialMenu: BotMenuItemConfig[];
  businessName: string;
  businessType?: string;
  initialGreetingMsg: string;
  initialMenuEnabled: boolean;
  initialGreetingEnabled: boolean;
  initialThanksMsg: string;
  initialThanksEnabled: boolean;
  initialAttendantName: string;
  initialAttendantNames: string[];
  initialAttendantEnabled: boolean;
  initialManualAttendantPrefixEnabled: boolean;
  autoReplyEnabled: boolean;
}) {
  const v = getBusinessVocabulary(businessType);
  const queryClient = useQueryClient();
  const [items, setItems] = useState<BotMenuItemConfig[]>(initialMenu);
  const [menuEnabled, setMenuEnabled] = useState(initialMenuEnabled);
  const [greetingEnabled, setGreetingEnabled] = useState(initialGreetingEnabled);
  const [greetingMsg, setGreetingMsg] = useState(initialGreetingMsg);
  const [thanksMsg, setThanksMsg] = useState(initialThanksMsg);
  const [thanksEnabled, setThanksEnabled] = useState(initialThanksEnabled);
  const [attendantNames, setAttendantNames] = useState<string[]>(() => {
    const normalized = Array.from(
      new Set(initialAttendantNames.map((name) => name.trim()).filter(Boolean))
    ).slice(0, 20);
    if (normalized.length > 0) return normalized;
    const fallback = initialAttendantName.trim();
    return fallback ? [fallback] : [""];
  });
  const [attendantEnabled, setAttendantEnabled] = useState(initialAttendantEnabled);
  const [manualAttendantPrefixEnabled, setManualAttendantPrefixEnabled] = useState(
    initialManualAttendantPrefixEnabled
  );
  const [previewFocus, setPreviewFocus] = useState<PreviewFocus>("greeting");

  // Modal state (shared for create + edit)
  const [modal, setModal] = useState<{
    open: boolean;
    index: number | null;
    label: string;
    response: string;
    emoji: string;
  }>({ open: false, index: null, label: "", response: "", emoji: "" });

  const [pickerAnchor, setPickerAnchor] = useState<{ el: HTMLElement } | null>(null);
  const greetingRef = useRef<HTMLTextAreaElement>(null);
  const thanksRef = useRef<HTMLTextAreaElement>(null);
  const modalResponseRef = useRef<HTMLTextAreaElement>(null);

  function dropTokenInGreeting(token: string) {
    const el = greetingRef.current;
    if (!el) return;
    const start = el.selectionStart ?? greetingMsg.length;
    const end = el.selectionEnd ?? greetingMsg.length;
    const next = insertToken(greetingMsg, token, start, end);
    setGreetingMsg(next);
    requestAnimationFrame(() => {
      const cursor = start + token.length;
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

  function dropTokenInThanks(token: string) {
    const el = thanksRef.current;
    if (!el) return;
    const start = el.selectionStart ?? thanksMsg.length;
    const end = el.selectionEnd ?? thanksMsg.length;
    const next = insertToken(thanksMsg, token, start, end);
    setThanksMsg(next);
    requestAnimationFrame(() => {
      const cursor = start + token.length;
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

  function dropTokenInModalResponse(token: string) {
    const el = modalResponseRef.current;
    const current = modal.response ?? "";
    if (!el) {
      setModal((m) => ({ ...m, response: `${current}${token}` }));
      return;
    }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    const next = insertToken(current, token, start, end);
    setModal((m) => ({ ...m, response: next }));
    requestAnimationFrame(() => {
      const cursor = start + token.length;
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      {
        const attendantNamesSanitized = Array.from(
          new Set(attendantNames.map((name) => name.trim()).filter(Boolean))
        ).slice(0, 20);
        const primaryAttendantName =
          attendantNamesSanitized[0] || undefined;
        return businessApi.update(businessId, {
        botMenu: items.map(({ action: _legacy, ...it }) => it),
        botMenuEnabled: menuEnabled,
        botAutoReplyEnabled: autoReplyEnabled,
        greetingEnabled,
        greetingMsg: greetingMsg.trim() || "Olá! Como posso ajudar?",
        thanksEnabled,
        thanksMsg: thanksMsg.trim() || DEFAULT_THANKS_MSG,
        attendantEnabled,
        attendantName: primaryAttendantName,
        attendantNames: attendantNamesSanitized.length ? attendantNamesSanitized : undefined,
        manualAttendantPrefixEnabled,
      } as any);
      },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business", businessId] });
      toast.success("Configuração da IA salva!");
    },
    onError: () => toast.error("Erro ao salvar configuração"),
  });

  function move(index: number, dir: -1 | 1) {
    setItems(prev => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next.map((it, i) => ({ ...it, num: i + 1 }));
    });
  }

  function toggle(index: number) {
    setItems(prev => prev.map((it, i) => i === index ? { ...it, enabled: !it.enabled } : it));
  }

  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index).map((it, i) => ({ ...it, num: i + 1 })));
  }

  function openCreate() {
    setModal({ open: true, index: null, label: "", response: "", emoji: "" });
  }

  function openEdit(i: number) {
    const it = items[i]!;
    setModal({ open: true, index: i, label: it.label, response: it.response, emoji: it.emoji ?? "" });
  }

  function closeModal() {
    setModal(m => ({ ...m, open: false }));
    setPickerAnchor(null);
  }

  function commitModal() {
    const label = modal.label.trim();
    const response = modal.response.trim();
    if (!label || !response) { toast.error("Preencha o nome e a resposta"); return; }
    if (modal.index === null) {
      setItems(prev => [...prev, { num: prev.length + 1, label, response, enabled: true, emoji: modal.emoji || undefined }]);
    } else {
      setItems(prev => prev.map((it, i) => i === modal.index ? { ...it, label, response, emoji: modal.emoji || undefined } : it));
    }
    closeModal();
  }

  const previewLines = buildPreviewLines(items, businessName, {
    menuEnabled,
    greetingEnabled,
    greetingMsg,
    attendantName: attendantNames.map((name) => name.trim()).find(Boolean) || "",
    thanksEnabled,
    thanksMsg,
    attendantEnabled,
    manualAttendantPrefixEnabled,
    focus: previewFocus,
  });
  const showPreview = previewLines.length > 0;
  const previewTitle: Record<PreviewFocus, string> = {
    greeting: "Prévia da saudação inicial",
    menu: "Prévia do menu numérico",
    thanks: "Prévia de agradecimento",
    attendant: "Prévia do nome no manual",
  };

  return (
    <div className={cn("grid gap-8", showPreview && "lg:grid-cols-[1fr_320px]")}>
      {/* Emoji picker portal */}
      {pickerAnchor?.el && (
        <EmojiPickerBalloon
          anchor={pickerAnchor.el}
          onSelect={(emoji) => setModal(m => ({ ...m, emoji }))}
          onClear={() => setModal(m => ({ ...m, emoji: "" }))}
          onClose={() => setPickerAnchor(null)}
        />
      )}

      {/* Edit / Create modal */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-600 to-brand-500 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg">
                  {modal.emoji || "✦"}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">
                    {modal.index === null ? "Nova opção do menu" : "Editar opção"}
                  </h3>
                  <p className="text-brand-200 text-xs mt-0.5">
                    Nome que aparece no menu + o que a IA responde
                  </p>
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon-sm" onClick={closeModal}
                className="rounded-xl bg-white/20 hover:bg-white/30 text-white">
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Nome + emoji */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome no menu
                  <span className="ml-1.5 text-xs font-normal text-gray-400">— o que o cliente vê na lista de opções</span>
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    title="Escolher emoji"
                    onClick={(e) => {
                      const el = e.currentTarget;
                      setPickerAnchor(prev => prev ? null : { el });
                    }}
                    className={cn(
                      "w-11 h-11 flex items-center justify-center rounded-xl border-2 bg-white flex-shrink-0 hover:scale-105 h-auto p-0",
                      modal.emoji
                        ? "text-[22px] border-gray-200 hover:border-brand-300"
                        : "text-gray-400 border-dashed border-gray-300 hover:border-brand-400 hover:text-brand-500"
                    )}
                  >
                    {modal.emoji || <Plus className="w-4 h-4" />}
                  </Button>
                  <input
                    type="text"
                    autoFocus
                    value={modal.label}
                    onChange={(e) => setModal(m => ({ ...m, label: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") commitModal(); if (e.key === "Escape") closeModal(); }}
                    placeholder={`Ex: ${v.botBookingMenuLabel}, ${v.botCatalogMenuLabel}, Horários…`}
                    className="input flex-1"
                  />
                </div>
              </div>

              {/* Resposta */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Resposta da IA
                  <span className="ml-1.5 text-xs font-normal text-gray-400">— enviada quando o cliente digitar o número</span>
                </label>
                <TemplateVariableBar onPick={dropTokenInModalResponse} />
                <textarea
                  ref={modalResponseRef}
                  value={modal.response}
                  onChange={(e) => setModal(m => ({ ...m, response: e.target.value }))}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const token = e.dataTransfer.getData("text/plain");
                    if (token.startsWith("{") && token.endsWith("}")) {
                      dropTokenInModalResponse(token);
                    }
                  }}
                  rows={4}
                  placeholder={v.botLegacyAppointmentHint}
                  className="input resize-none h-28 mt-2"
                />
                <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  Use <code className="mx-1 bg-gray-100 px-1 rounded font-mono">{"{nome}"}</code> ou
                  <code className="mx-1 bg-gray-100 px-1 rounded font-mono">{"{negocio}"}</code> ou
                  <code className="mx-1 bg-gray-100 px-1 rounded font-mono">{"{atendente}"}</code> para personalizar
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={closeModal}>Cancelar</Button>
                <Button
                  type="button"
                  className="flex-1"
                  disabled={!modal.label.trim() || !modal.response.trim()}
                  onClick={commitModal}
                >
                  <Check className="w-4 h-4" />
                  {modal.index === null ? "Adicionar" : "Salvar alterações"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Editor */}
      <div>
        <div className="space-y-3 mb-6">
          <ToggleRow
            label="Saudação inicial"
            hint="Mensagem de boas-vindas antes do menu ou das respostas automáticas."
            checked={greetingEnabled}
            onChange={setGreetingEnabled}
            disabled={!autoReplyEnabled}
            onPreview={() => setPreviewFocus("greeting")}
          />
          {greetingEnabled && autoReplyEnabled && (
            <div className="space-y-2">
              <TemplateVariableBar onPick={dropTokenInGreeting} />
              <textarea
                ref={greetingRef}
                value={greetingMsg}
                onChange={(e) => setGreetingMsg(e.target.value)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const token = e.dataTransfer.getData("text/plain");
                  if (token.startsWith("{") && token.endsWith("}")) {
                    dropTokenInGreeting(token);
                  }
                }}
                rows={3}
                className="input resize-none w-full"
                placeholder={`Olá {nome}! Bem-vindo ao {negocio} 😊 Como posso ajudar?`}
              />
              <p className="text-xs text-gray-500">
                Variáveis: <code className="bg-gray-100 px-1 rounded font-mono">{"{nome}"}</code>,{" "}
                <code className="bg-gray-100 px-1 rounded font-mono">{"{negocio}"}</code>,{" "}
                <code className="bg-gray-100 px-1 rounded font-mono">{"{atendente}"}</code>.
              </p>
            </div>
          )}

          <ToggleRow
            label="Menu numérico"
            hint="Desativado: a IA responde só pelas perguntas e respostas cadastradas."
            checked={menuEnabled}
            onChange={setMenuEnabled}
            disabled={!autoReplyEnabled}
            onPreview={() => setPreviewFocus("menu")}
          />

          {menuEnabled && (
            <>
              <p className="text-sm text-gray-500 mb-5">
                Cada opção tem um <strong className="font-medium text-gray-700">nome</strong> que aparece no menu e uma{" "}
                <strong className="font-medium text-gray-700">resposta</strong> que a IA envia quando o cliente escolhe aquele número.
              </p>

              <div className="rounded-2xl border border-gray-200 overflow-hidden mb-4 shadow-sm divide-y divide-gray-100">
                {items.length === 0 && (
                  <div className="px-4 py-10 text-center text-sm text-gray-400">
                    Nenhum item ainda — clique em "Adicionar opção" abaixo
                  </div>
                )}
                {items.map((item, i) => {
                  const displayEmoji = item.emoji;
                  return (
                    <div
                      key={`menu-${i}-${item.num}`}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 transition-colors group",
                        item.enabled ? "bg-white hover:bg-gray-50/60" : "bg-gray-50 opacity-55"
                      )}
                    >
                      <span className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0",
                        item.enabled ? "bg-brand-600 text-white" : "bg-gray-200 text-gray-400"
                      )}>
                        {item.num}
                      </span>
                      {displayEmoji ? (
                        <span className="text-[18px] flex-shrink-0 w-8 text-center leading-none">{displayEmoji}</span>
                      ) : (
                        <div className="w-8 flex-shrink-0" />
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => openEdit(i)}
                        className="flex-1 min-w-0 h-auto justify-start text-left rounded-none px-0 hover:bg-transparent"
                      >
                        <p className="text-sm font-medium text-gray-900 group-hover:text-brand-700 transition-colors truncate">
                          {item.label}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {item.response || <span className="text-amber-500 italic">Sem resposta</span>}
                        </p>
                      </Button>
                      <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button type="button" variant="ghost" size="icon-xs" onClick={() => openEdit(i)}
                          className="text-gray-400 hover:text-brand-600 hover:bg-brand-50"
                          title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <div className="flex rounded-lg border border-gray-200 overflow-hidden divide-x divide-gray-200">
                          <Button type="button" variant="ghost" size="icon-xs" onClick={() => move(i, -1)} disabled={i === 0}
                            className="text-gray-400 hover:bg-gray-50 rounded-none">
                            <ChevronUp className="w-3.5 h-3.5" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon-xs" onClick={() => move(i, 1)} disabled={i === items.length - 1}
                            className="text-gray-400 hover:bg-gray-50 rounded-none">
                            <ChevronDown className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <Switch
                          checked={item.enabled}
                          size="sm"
                          onCheckedChange={() => toggle(i)}
                        />
                        <Button type="button" variant="ghost" size="icon-xs" onClick={() => removeItem(i)}
                          className="text-gray-300 hover:text-red-500 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button type="button" variant="ghost" onClick={openCreate}
                className="w-full h-auto flex items-center justify-center gap-2 py-3 mb-4 rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50/50 group"
              >
                <div className="w-6 h-6 rounded-full bg-gray-100 group-hover:bg-brand-100 flex items-center justify-center transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                </div>
                Adicionar opção
              </Button>
            </>
          )}

          <div
            className={cn(
              "rounded-2xl border border-gray-200 bg-white px-4 py-3.5",
              !autoReplyEnabled && "opacity-50 pointer-events-none"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Resposta de agradecimento</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Quando o cliente mandar obrigado, valeu, vlw ou parecido.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => setPreviewFocus("thanks")}
                  className="text-xs text-brand-700 hover:text-brand-900 border-brand-200 bg-brand-50 h-auto"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Prévia
                </Button>
                <Switch
                  checked={thanksEnabled}
                  onCheckedChange={setThanksEnabled}
                  className="mt-0.5"
                  title="Ativar/desativar resposta de agradecimento"
                />
              </div>
            </div>
            {thanksEnabled ? (
              <>
                <textarea
                  ref={thanksRef}
                  value={thanksMsg}
                  onChange={(e) => setThanksMsg(e.target.value)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const token = e.dataTransfer.getData("text/plain");
                    if (token.startsWith("{") && token.endsWith("}")) {
                      dropTokenInThanks(token);
                    }
                  }}
                  rows={2}
                  className="input resize-none w-full mt-3"
                  placeholder={DEFAULT_THANKS_MSG}
                  disabled={!autoReplyEnabled}
                />
                <div className="mt-2">
                  <TemplateVariableBar onPick={dropTokenInThanks} />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Variáveis: <code className="bg-gray-100 px-1 rounded font-mono">{"{nome}"}</code>,{" "}
                  <code className="bg-gray-100 px-1 rounded font-mono">{"{negocio}"}</code>,{" "}
                  <code className="bg-gray-100 px-1 rounded font-mono">{"{atendente}"}</code>.
                </p>
              </>
            ) : (
              <p className="text-xs text-gray-500 mt-2">Resposta de agradecimento desativada.</p>
            )}
          </div>

          <div
            className={cn(
              "rounded-2xl border border-gray-200 bg-white px-4 py-3.5",
              !autoReplyEnabled && "opacity-50 pointer-events-none"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Nome de quem atende</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  A IA pode usar esse nome quando você escrever <code className="bg-gray-100 px-1 rounded font-mono">{"{atendente}"}</code>.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => setPreviewFocus("attendant")}
                  className="text-xs text-brand-700 hover:text-brand-900 border-brand-200 bg-brand-50 h-auto"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Prévia
                </Button>
                <Switch
                  checked={attendantEnabled}
                  onCheckedChange={setAttendantEnabled}
                  className="mt-0.5"
                  title="Ativar/desativar nome de quem atende"
                />
              </div>
            </div>
            {attendantEnabled ? (
              <>
                <div className="mt-3 space-y-2">
                  {attendantNames.map((name, index) => (
                    <div key={`attendant-${index}`} className="flex items-center gap-2">
                      <input
                        value={name}
                        onChange={(e) =>
                          setAttendantNames((prev) =>
                            prev.map((current, i) => (i === index ? e.target.value : current))
                          )
                        }
                        className="input w-full"
                        placeholder={`Nome do atendente ${index + 1}`}
                        disabled={!autoReplyEnabled}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          setAttendantNames((prev) => {
                            if (prev.length <= 1) return [""];
                            return prev.filter((_, i) => i !== index);
                          })
                        }
                        className="h-10 w-10 border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
                        disabled={!autoReplyEnabled}
                        title="Apagar atendente"
                      >
                        <Trash2 className="w-4 h-4 mx-auto" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() =>
                    setAttendantNames((prev) =>
                      prev.length >= 20 ? prev : [...prev, ""]
                    )
                  }
                  className="mt-2 text-xs text-brand-700 hover:text-brand-900 border-brand-200 bg-brand-50 h-auto"
                  disabled={!autoReplyEnabled || attendantNames.length >= 20}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar atendente
                </Button>
                <p className="text-xs text-gray-500 mt-2">
                  Lista de atendentes para escolher no atendimento manual.
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Envio manual em Conversas:{" "}
                  <strong>{manualAttendantPrefixEnabled ? "ativado" : "desativado"}</strong>.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => setManualAttendantPrefixEnabled((v) => !v)}
                  className="mt-2 text-xs text-brand-700 hover:text-brand-900 border-brand-200 bg-brand-50 h-auto"
                >
                  {manualAttendantPrefixEnabled ? "Desativar no envio manual" : "Ativar no envio manual"}
                </Button>
              </>
            ) : (
              <p className="text-xs text-gray-500 mt-2">Nome de quem atende desativado.</p>
            )}
          </div>
        </div>

        <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
          className="shadow-sm">
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar configuração
        </Button>
      </div>

      {/* Preview */}
      {showPreview && (
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-gray-100 text-sm font-medium text-gray-600">
          <Eye className="w-4 h-4" />
          {previewTitle[previewFocus]}
        </div>

        <div className="relative w-[270px] select-none">
          <div className="relative rounded-[3.2rem] bg-gradient-to-b from-[#3A3A3C] to-[#1C1C1E] shadow-[0_30px_60px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.12)] border border-[#48484A]">
            <div className="absolute -left-[3px] top-[72px] w-[3px] h-6 bg-[#3A3A3C] rounded-l-full" />
            <div className="absolute -left-[3px] top-[106px] w-[3px] h-10 bg-[#3A3A3C] rounded-l-full" />
            <div className="absolute -left-[3px] top-[152px] w-[3px] h-10 bg-[#3A3A3C] rounded-l-full" />
            <div className="absolute -right-[3px] top-[114px] w-[3px] h-14 bg-[#3A3A3C] rounded-r-full" />
            <div className="m-[6px] rounded-[2.7rem] overflow-hidden bg-black">
              <div className="relative bg-[#075E54] flex items-center justify-between px-4 h-[36px]">
                <span className="text-white text-[9px] font-semibold tracking-tight z-10">9:41</span>
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[82px] h-[24px] bg-black rounded-full flex items-center justify-center gap-2 z-20">
                  <div className="w-[7px] h-[7px] rounded-full bg-[#1a1a1a] border border-[#333]" />
                  <div className="w-2 h-2 rounded-full bg-[#222] border border-[#3a3a3a]" />
                </div>
                <div className="flex items-center gap-1.5 z-10">
                  <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                    <rect x="0" y="6" width="2.5" height="4" rx="0.4" fill="white"/>
                    <rect x="3.5" y="4" width="2.5" height="6" rx="0.4" fill="white"/>
                    <rect x="7" y="2" width="2.5" height="8" rx="0.4" fill="white"/>
                    <rect x="10.5" y="0" width="2.5" height="10" rx="0.4" fill="white" opacity="0.35"/>
                  </svg>
                  <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
                    <path d="M6.5 8a1 1 0 110 2 1 1 0 010-2z" fill="white"/>
                    <path d="M3.5 6C4.5 5 5.4 4.5 6.5 4.5S8.5 5 9.5 6" stroke="white" strokeWidth="1.1" strokeLinecap="round"/>
                    <path d="M1.5 4C3 2.5 4.7 1.5 6.5 1.5s3.5 1 5 2.5" stroke="white" strokeWidth="1.1" strokeLinecap="round" opacity="0.5"/>
                  </svg>
                  <svg width="20" height="10" viewBox="0 0 20 10" fill="none">
                    <rect x="0.5" y="0.5" width="16" height="9" rx="2" stroke="white" strokeOpacity="0.5"/>
                    <rect x="2" y="2" width="12" height="6" rx="1" fill="white"/>
                    <path d="M17.5 3.5v3a1.5 1.5 0 000-3z" fill="white" fillOpacity="0.5"/>
                  </svg>
                </div>
              </div>
              <div className="bg-[#075E54] px-3 py-2 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#128C7E] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {businessName.trim()[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white text-[11px] font-semibold leading-none truncate">{businessName}</p>
                  <p className="text-[#A8D5CF] text-[9px] mt-0.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4FC3F7] inline-block flex-shrink-0" />
                    online agora
                  </p>
                </div>
                <div className="flex gap-0.5">
                  {[0,1,2].map(i => <div key={i} className="w-1 h-1 rounded-full bg-white/60" />)}
                </div>
              </div>
              <div className="px-3 py-3 min-h-[340px]"
                style={{ background: "#E5DDD5 url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }}
              >
                <div className="flex justify-center mb-3">
                  <span className="bg-black/20 text-white text-[9px] px-2 py-0.5 rounded-full">Hoje</span>
                </div>
                <div className="flex justify-end">
                  <div className="relative rounded-2xl rounded-tr-sm px-3 py-2 shadow-sm"
                    style={{ fontSize: "11.5px", lineHeight: "1.55", maxWidth: "88%", backgroundColor: "#DCF8C6" }}
                  >
                    <div className="absolute -right-[7px] top-0 w-0 h-0"
                      style={{ borderTop: "8px solid #DCF8C6", borderRight: "8px solid transparent" }} />
                    <WaMessage lines={previewLines} />
                    <div className="flex justify-end items-center gap-1 mt-1.5">
                      <span className="text-[9px] text-gray-400">agora</span>
                      <svg width="14" height="8" viewBox="0 0 14 8" fill="none">
                        <path d="M1 4l2.5 2.5L8 1" stroke="#53BDEB" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M5 4l2.5 2.5L12 1" stroke="#53BDEB" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-[#F0F2F5] px-2 py-2 flex items-center gap-1.5">
                <div className="flex-1 bg-white rounded-full px-3 py-1.5 shadow-sm">
                  <span className="text-[10px] text-gray-400">Mensagem</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-[#128C7E] flex items-center justify-center shadow-sm flex-shrink-0">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </div>
              </div>
              <div className="bg-[#F0F0F0] flex justify-center pb-1.5 pt-0.5">
                <div className="w-20 h-1 bg-black/25 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

// ── WhatsApp markdown ──────────────────────────────────────────────────────────
function WaMessage({ lines }: { lines: WaLine[] }) {
  return (
    <div className="text-gray-800 space-y-0 leading-[1.5]" style={{ fontSize: "12px" }}>
      {lines.map((line, i) => (
        <p key={i} className={line.blank ? "h-2" : ""}>
          {!line.blank && <WaInline text={line.text ?? ""} />}
        </p>
      ))}
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

interface WaLine { text?: string; blank?: boolean }

function buildPreviewLines(
  items: BotMenuItemConfig[],
  name: string,
  opts: {
    menuEnabled: boolean;
    greetingEnabled: boolean;
    greetingMsg: string;
    attendantName: string;
    thanksEnabled: boolean;
    thanksMsg: string;
    attendantEnabled: boolean;
    manualAttendantPrefixEnabled: boolean;
    focus: PreviewFocus;
  },
): WaLine[] {
  const hasGreeting = opts.greetingEnabled && opts.greetingMsg.trim();

  const lines: WaLine[] = [];

  if (opts.focus === "greeting") {
    if (!hasGreeting) return [{ text: "_Saudação está desativada_" }];
    const greeting = renderTemplate(opts.greetingMsg, {
      nome: "Maria",
      negocio: name,
      atendente: opts.attendantName?.trim() || "Equipe",
    });
    for (const part of greeting.split("\n")) {
      if (part.trim()) lines.push({ text: part });
    }
    return lines.length ? lines : [{ text: "_Digite uma saudação para ver a prévia_" }];
  }

  if (opts.focus === "thanks") {
    if (!opts.thanksEnabled) return [{ text: "_Resposta de agradecimento desativada_" }];
    const msg = renderTemplate(opts.thanksMsg?.trim() || DEFAULT_THANKS_MSG, {
      nome: "Maria",
      negocio: name,
      atendente: opts.attendantName?.trim() || "Equipe",
    });
    for (const part of msg.split("\n")) {
      if (part.trim()) lines.push({ text: part });
    }
    return lines.length ? lines : [{ text: DEFAULT_THANKS_MSG }];
  }

  if (opts.focus === "attendant") {
    if (!opts.attendantEnabled) return [{ text: "_Nome de quem atende desativado_" }];
    const who = opts.attendantName?.trim() || "Atendente";
    if (!opts.manualAttendantPrefixEnabled) {
      return [{ text: "Olá bom dia, como vai?" }, { blank: true }, { text: "_Prefixo manual desativado_" }];
    }
    return [{ text: `${who}:` }, { text: "Olá bom dia, como vai?" }];
  }

  if (!opts.menuEnabled) return [{ text: "_Menu está desativado_" }];

  const enabled = items.filter((i) => i.enabled);
  if (!enabled.length) {
    lines.push({ text: `*${name}*` });
    lines.push({ blank: true });
    lines.push({ text: "_Menu vazio — adicione itens ao lado_" });
    return lines;
  }
  lines.push({ text: `*Menu — ${name}*` });
  lines.push({ blank: true });
  enabled.forEach((e) => {
    const prefix = e.emoji ? `${e.emoji} ` : "";
    lines.push({ text: `*${e.num}* — ${prefix}${e.label}` });
  });
  lines.push({ blank: true });
  lines.push({ text: `*0* — 👋 Sair` });
  lines.push({ blank: true });
  lines.push({ text: `_Digite o número da opção desejada_` });
  return lines;
}

// ── FAQsEditor ─────────────────────────────────────────────────────────────────
function faqSuggestions(businessType?: string) {
  const v = getBusinessVocabulary(businessType);
  const kw = v.botAppointmentKeywords.slice(0, 4).join(",");
  return [
    { icon: "🕐", color: "bg-blue-50 border-blue-200 hover:border-blue-400 hover:bg-blue-50", iconBg: "bg-blue-100 text-blue-600", question: "Qual o horário de funcionamento?", answer: "Funcionamos de segunda a sexta das 9h às 18h, sábados das 9h às 14h.", keywords: "horário,funcionamento,abre,fecha" },
    { icon: "📍", color: "bg-purple-50 border-purple-200 hover:border-purple-400 hover:bg-purple-50", iconBg: "bg-purple-100 text-purple-600", question: "Onde vocês ficam localizados?", answer: "Estamos na Rua [endereço]. Confira no Google Maps: [link].", keywords: "endereço,onde,localização,fica" },
    { icon: "📅", color: "bg-emerald-50 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50", iconBg: "bg-emerald-100 text-emerald-600", question: `Como funciona ${v.bookingsPlural.toLowerCase().replace(/s$/, "")}?`, answer: `Digite *${v.botAppointmentKeywords[0] ?? "agendar"}* aqui no WhatsApp e siga as instruções.`, keywords: `${kw},como funciona` },
    { icon: "💳", color: "bg-amber-50 border-amber-200 hover:border-amber-400 hover:bg-amber-50", iconBg: "bg-amber-100 text-amber-600", question: "Vocês aceitam cartão?", answer: "Sim! Aceitamos cartão de crédito, débito e PIX.", keywords: "cartão,pagamento,pix,forma de pagamento" },
  ];
}

function FAQsEditor({ businessId, businessType }: { businessId: string; businessType?: string }) {
  const suggestions = faqSuggestions(businessType);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: faqs = [], isLoading } = useQuery({
    queryKey: ["faqs", businessId],
    queryFn: () => faqApi.list(businessId),
  });

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<FAQForm>({
    resolver: zodResolver(faqSchema),
  });

  function openCreate() {
    setEditingId(null);
    reset({ question: "", answer: "", keywords: "" });
    setShowForm(true);
  }

  function openEdit(faq: { id: string; question: string; answer: string; keywords: string[] }) {
    setEditingId(faq.id);
    reset({ question: faq.question, answer: faq.answer, keywords: faq.keywords.join(", ") });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    reset();
  }

  const saveMutation = useMutation({
    mutationFn: async (data: FAQForm) => {
      const payload = {
        question: data.question,
        answer: data.answer,
        keywords: data.keywords.split(",").map((k) => k.trim()).filter(Boolean),
        active: true,
      };
      if (editingId) await faqApi.update(businessId, editingId, payload);
      else await faqApi.create(businessId, { ...payload, sortOrder: faqs.length });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faqs", businessId] });
      closeForm();
      toast.success(editingId ? "Pergunta atualizada!" : "Pergunta adicionada!");
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => faqApi.remove(businessId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["faqs", businessId] });
      toast.success("Pergunta removida");
    },
  });

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200">
          <Zap className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-700 font-medium">
            A IA responde 24h por palavras-chave — tolera erros de digitação e texto sem acento
          </p>
        </div>
        <Button className="ml-4 flex-shrink-0" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          Nova pergunta
        </Button>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className="bg-gradient-to-r from-brand-600 to-brand-500 px-6 py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                    <MessageCircleQuestion className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      {editingId ? "Editar pergunta" : "Nova pergunta"}
                    </h3>
                    <p className="text-brand-200 text-xs mt-0.5">
                      {editingId ? "Atualize a pergunta e sua resposta" : "Adicione uma nova resposta automática"}
                    </p>
                  </div>
                </div>
                <Button type="button" variant="ghost" size="icon-sm" onClick={closeForm}
                  className="rounded-xl bg-white/20 hover:bg-white/30 text-white">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit((d) => saveMutation.mutate(d))} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-brand-500" />
                    Pergunta do cliente
                  </span>
                </label>
                <input type="text" className="input"
                  placeholder="Qual o horário de funcionamento?" {...register("question")} />
                {errors.question && <p className="text-xs text-red-500 mt-1">{errors.question.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-brand-500" />
                    Resposta da IA
                  </span>
                </label>
                <textarea className="input h-28 resize-none"
                  placeholder="Funcionamos de segunda a sexta..." {...register("answer")} />
                {errors.answer && <p className="text-xs text-red-500 mt-1">{errors.answer.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-brand-500" />
                    Palavras-chave
                    <span className="font-normal text-gray-400">(separadas por vírgula)</span>
                  </span>
                </label>
                <input type="text" className="input"
                  placeholder="horário, funcionamento, abre, fecha" {...register("keywords")} />
                <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  A IA reconhece com ou sem acento e com pequenos erros de digitação
                </p>
                {errors.keywords && <p className="text-xs text-red-500 mt-1">{errors.keywords.message}</p>}
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={closeForm}>Cancelar</Button>
                <Button type="submit" className="flex-1" disabled={isSubmitting || saveMutation.isPending}>
                  {(isSubmitting || saveMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingId ? "Salvar alterações" : "Adicionar pergunta"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : faqs.length === 0 ? (
        /* Empty state */
        <div>
          {/* Empty illustration */}
          <div className="flex flex-col items-center text-center py-10 mb-8">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center mb-4 shadow-sm">
              <MessageCircleQuestion className="w-10 h-10 text-brand-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-800 mb-1">Nenhuma pergunta ainda</h3>
            <p className="text-sm text-gray-400 max-w-xs">
              Adicione perguntas frequentes para a IA responder automaticamente 24 horas por dia.
            </p>
          </div>

          {/* Suggestions */}
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-2">
                Sugestões para começar
              </span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {suggestions.map((s) => (
                <Button
                  key={s.question}
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingId(null);
                    setValue("question", s.question);
                    setValue("answer", s.answer);
                    setValue("keywords", s.keywords);
                    setShowForm(true);
                  }}
                  className={cn(
                    "h-auto w-full text-left rounded-2xl border-2 p-4 transition-all group",
                    s.color
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0", s.iconBg)}>
                      {s.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-900 mb-1 group-hover:text-gray-800">
                        {s.question}
                      </p>
                      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{s.answer}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-xs font-medium text-gray-400 group-hover:text-gray-600 transition-colors">
                    <Plus className="w-3 h-3" />
                    Usar esta sugestão
                  </div>
                </Button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* FAQ list */
        <div className="space-y-3">
          {(faqs as any[]).map((faq, idx) => (
            <div key={faq.id}
              className="group rounded-2xl border border-gray-200 bg-white overflow-hidden hover:border-brand-200 hover:shadow-sm transition-all"
            >
              {/* Colored top accent */}
              <div className="h-1 bg-gradient-to-r from-brand-400 to-brand-600 opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Question */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-8 h-8 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <HelpCircle className="w-4 h-4 text-brand-600" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-brand-600 uppercase tracking-wider mb-0.5">Pergunta</p>
                        <p className="font-semibold text-sm text-gray-900 leading-snug">{faq.question}</p>
                      </div>
                    </div>

                    {/* Answer */}
                    <div className="flex items-start gap-3 mb-3 ml-0">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <MessageSquare className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider mb-0.5">Resposta</p>
                        <p className="text-sm text-gray-600 leading-relaxed">{faq.answer}</p>
                      </div>
                    </div>

                    {/* Keywords */}
                    {faq.keywords.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap ml-11">
                        <Hash className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        {faq.keywords.map((kw: string) => (
                          <span key={kw}
                            className="inline-flex items-center rounded-lg bg-gray-100 hover:bg-brand-100 hover:text-brand-700 px-2.5 py-1 text-xs text-gray-600 font-medium transition-colors">
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEdit(faq)}
                      className="rounded-xl text-gray-400 hover:text-brand-600 hover:bg-brand-50"
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => { if (confirm("Remover esta pergunta?")) deleteMutation.mutate(faq.id); }}
                      disabled={deleteMutation.isPending}
                      className="rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Add more */}
          <Button
            type="button"
            variant="outline"
            onClick={openCreate}
            className="h-auto w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50/50 group"
          >
            <div className="w-6 h-6 rounded-full bg-gray-100 group-hover:bg-brand-100 flex items-center justify-center transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </div>
            Adicionar mais uma pergunta
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function BotPage() {
  const businessId = useBusinessId();
  const searchParams = useSearchParams();
  const router = useAppRouter();
  const queryClient = useQueryClient();
  const { pixEnabled } = usePlanAllowsPix();
  const [tab, setTab] = useState<Tab>("menu");
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);

  useEffect(() => {
    if (searchParams.get("sec") === "pix" && pixEnabled) {
      router.replace(panelHref(businessId, "payments"));
    }
  }, [searchParams, pixEnabled, businessId, router]);

  const { data: business, isLoading } = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => businessApi.get(businessId),
  });

  useEffect(() => {
    if (!business) return;
    setAutoReplyEnabled((business as { botAutoReplyEnabled?: boolean }).botAutoReplyEnabled !== false);
  }, [business]);

  const autoReplyMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      businessApi.update(businessId, { botAutoReplyEnabled: enabled } as Record<string, unknown>),
    onSuccess: (_data, enabled) => {
      void queryClient.invalidateQueries({ queryKey: ["business", businessId] });
      toast.success(
        enabled
          ? "Respostas automáticas ativadas — configure menu, fluxo conversacional e perguntas abaixo."
          : "Respostas automáticas desativadas."
      );
    },
    onError: () => toast.error("Erro ao atualizar respostas automáticas"),
  });

  const iaTabs = autoReplyEnabled
    ? ([
        { id: "menu" as const, label: "Menu da IA", icon: MessageSquare },
        { id: "faqs" as const, label: "Perguntas & Respostas", icon: HelpCircle },
        { id: "leadflow" as const, label: "Fluxo conversacional", icon: GitBranch },
      ] as const)
    : [];

  useEffect(() => {
    if (autoReplyEnabled) return;
    if (tab !== "menu") setTab("menu");
  }, [autoReplyEnabled, tab]);

  const { data: tenant } = useQuery({
    queryKey: ["tenant"],
    queryFn: () => tenantApi.get(),
  });

  const savedMenu = (business as any)?.botMenu as Partial<BotMenuItemConfig>[] | undefined;
  const initialMenu = migrateMenu(savedMenu, business?.type, tenant?.plan);
  const initialLeadFlow = business?.leadFlow;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-500 to-blue-500 p-6 mb-8 shadow-lg">
        {/* Decorative circles */}
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-12 -left-6 w-48 h-48 rounded-full bg-white/5" />

        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-sm flex-shrink-0">
            <IaIcon className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Configuração da IA</h1>
            <p className="text-brand-100 text-sm mt-0.5">
              Personalize saudação, menu, fluxo conversacional e respostas automáticas da IA no WhatsApp
            </p>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "mb-6 rounded-2xl border-2 px-4 py-4 transition-colors",
          autoReplyEnabled ? "border-brand-200 bg-brand-50/50" : "border-amber-200 bg-amber-50"
        )}
      >
        <ToggleRow
          label="Respostas automáticas da IA"
          hint="Desligado: a IA não envia nada no WhatsApp. Ligado: configure menu, fluxo conversacional e perguntas nas abas abaixo."
          checked={autoReplyEnabled}
          disabled={autoReplyMutation.isPending || isLoading}
          onChange={(enabled) => {
            setAutoReplyEnabled(enabled);
            autoReplyMutation.mutate(enabled);
          }}
        />
      </div>

      {!autoReplyEnabled && (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
          Com as respostas desligadas, o menu, o fluxo conversacional e as perguntas ficam ocultos. Ative o interruptor acima
          para configurá-los, ou responda manualmente em Conversas.
        </p>
      )}

      {iaTabs.length > 0 && (
        <div className="flex flex-wrap gap-1 p-1.5 bg-gray-100 rounded-2xl w-fit mb-8 shadow-inner">
          {iaTabs.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              type="button"
              variant="ghost"
              onClick={() => setTab(id)}
              className={cn(
                "h-auto flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all",
                tab === id
                  ? "bg-white text-gray-900 shadow-sm hover:bg-white"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Icon className={cn("w-4 h-4", tab === id ? "text-brand-600" : "text-gray-400")} />
              {label}
            </Button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : !autoReplyEnabled ? null : tab === "menu" && autoReplyEnabled ? (
        <BotMenuEditor
          businessId={businessId}
          initialMenu={initialMenu}
          businessName={business?.name ?? "Meu Negócio"}
          businessType={business?.type}
          initialGreetingMsg={business?.greetingMsg ?? "Olá {nome}! Bem-vindo ao {negocio} 😊 Como posso ajudar?"}
          initialMenuEnabled={(business as { botMenuEnabled?: boolean })?.botMenuEnabled !== false}
          initialGreetingEnabled={(business as { greetingEnabled?: boolean })?.greetingEnabled !== false}
          initialThanksMsg={
            (business as { thanksMsg?: string })?.thanksMsg?.trim() ||
            DEFAULT_THANKS_MSG
          }
          initialThanksEnabled={(business as { thanksEnabled?: boolean })?.thanksEnabled !== false}
          initialAttendantName={(business as { attendantName?: string })?.attendantName?.trim() || ""}
          initialAttendantNames={
            (business as { attendantNames?: string[] })?.attendantNames?.filter(Boolean) || []
          }
          initialAttendantEnabled={(business as { attendantEnabled?: boolean })?.attendantEnabled !== false}
          initialManualAttendantPrefixEnabled={
            (business as { manualAttendantPrefixEnabled?: boolean })?.manualAttendantPrefixEnabled !== false
          }
          autoReplyEnabled={autoReplyEnabled}
        />
      ) : tab === "faqs" && autoReplyEnabled ? (
        <FAQsEditor businessId={businessId} businessType={business?.type} />
      ) : tab === "leadflow" && autoReplyEnabled ? (
        <LeadFlowEditor
          businessId={businessId}
          businessName={business?.name ?? "Meu Negócio"}
          initialFlow={initialLeadFlow}
        />
      ) : null}
    </div>
  );
}

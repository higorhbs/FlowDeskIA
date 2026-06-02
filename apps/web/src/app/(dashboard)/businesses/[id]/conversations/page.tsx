"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { businessApi, conversationApi, whatsappApi } from "@/lib/api";
import { useBusinessId } from "@/lib/use-business-id";
import { formatCustomerLabel, STATUS_LABELS, cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, Send, User, Loader2, Search, Trash2, Paperclip, X, Play, Pause, Mic } from "lucide-react";
import { IaIcon, IA_DISPLAY_NAME, isIaMessageRole } from "@/lib/ia-brand";
import { getClientAuth } from "@flowdesk/firebase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Conversation = {
  id: string;
  customerPhone: string;
  replyJid?: string;
  customerName?: string;
  status: string;
  lastMessageAt: string;
  messages?: Message[];
};

type MessageMediaType = "image" | "video" | "audio";

type Message = {
  id: string;
  role: "CUSTOMER" | "IA" | "HUMAN" | "BOT";
  content: string;
  mediaUrl?: string;
  mediaType?: MessageMediaType;
  createdAt: string;
};

const MEDIA_PLACEHOLDERS = new Set(["[imagem]", "[video]", "[audio]", "[documento]", "[sticker]"]);

function shouldShowMessageText(content: string, hasMedia: boolean) {
  const trimmed = content.trim();
  if (!trimmed) return false;
  if (hasMedia && MEDIA_PLACEHOLDERS.has(trimmed)) return false;
  return true;
}

function isMediaPlaceholderOnly(content: string) {
  return MEDIA_PLACEHOLDERS.has(content.trim());
}

// Fake waveform heights — gives the WhatsApp voice message visual feel
const WAVE_BARS = [4,7,11,15,18,13,8,16,10,7,17,11,14,6,9,14,7,12,16,9,14,7,11,15,8,13,6,10,14,5];

function AudioPlayer({ src, isOwn }: { src: string; isOwn: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  const progress = duration > 0 ? current / duration : 0;

  function fmt(s: number) {
    if (!isFinite(s) || s < 0) return "0:00";
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  }

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    playing ? a.pause() : a.play();
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  }

  return (
    <div className="flex items-center gap-2.5 min-w-[200px] py-0.5">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={() => setCurrent(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={() => { setPlaying(false); setCurrent(0); if (audioRef.current) audioRef.current.currentTime = 0; }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      {/* Play / pause */}
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center transition-colors",
          isOwn
            ? "bg-white/20 hover:bg-white/30 text-white"
            : "bg-brand-100 hover:bg-brand-200 text-brand-700"
        )}
      >
        {playing
          ? <Pause className="w-3.5 h-3.5" />
          : <Play className="w-3.5 h-3.5 ml-0.5" />}
      </button>

      {/* Waveform + duration */}
      <div className="flex-1 min-w-0">
        <div
          className="flex items-end gap-px h-5 mb-1 cursor-pointer"
          onClick={seek}
        >
          {WAVE_BARS.map((h, i) => {
            const filled = i / WAVE_BARS.length <= progress;
            return (
              <div
                key={i}
                className={cn(
                  "flex-1 rounded-sm transition-colors",
                  filled
                    ? isOwn ? "bg-white/85" : "bg-brand-500"
                    : isOwn ? "bg-white/30" : "bg-gray-300"
                )}
                style={{ height: h }}
              />
            );
          })}
        </div>
        <p className={cn("text-[10px] leading-none tabular-nums", isOwn ? "text-white/65" : "text-gray-400")}>
          {playing || current > 0 ? fmt(current) : fmt(duration)}
        </p>
      </div>

      <Mic className={cn("w-3.5 h-3.5 flex-shrink-0", isOwn ? "text-white/50" : "text-gray-300")} />
    </div>
  );
}

function ConversationMessageBody({ msg }: { msg: Message }) {
  const hasMedia = Boolean(msg.mediaUrl && msg.mediaType);
  const isOwn = msg.role !== "CUSTOMER";
  return (
    <>
      {hasMedia && msg.mediaType === "image" && (
        <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="block mb-2">
          <img src={msg.mediaUrl} alt="" className="max-w-full max-h-64 rounded-lg object-cover" />
        </a>
      )}
      {hasMedia && msg.mediaType === "video" && (
        <video src={msg.mediaUrl} controls className="max-w-full max-h-64 rounded-lg mb-2" />
      )}
      {hasMedia && msg.mediaType === "audio" && msg.mediaUrl && (
        <div className="mb-1.5">
          <AudioPlayer src={msg.mediaUrl} isOwn={isOwn} />
        </div>
      )}
      {!hasMedia && isMediaPlaceholderOnly(msg.content) && (
        <p className="text-xs opacity-80 italic">
          Áudio/mídia recebido — peça para enviar de novo após atualização do servidor.
        </p>
      )}
      {shouldShowMessageText(msg.content, hasMedia) && (
        <p className="whitespace-pre-wrap">{msg.content}</p>
      )}
    </>
  );
}

function buildManualMessage(raw: string, attendantName?: string, enabled = true) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (!enabled) return trimmed;
  const prefixName = attendantName?.trim();
  if (!prefixName) return trimmed;
  const alreadyPrefixed =
    trimmed.startsWith(`${prefixName}:\n`) || trimmed.startsWith(`${prefixName}: `);
  if (alreadyPrefixed) return trimmed;
  return `${prefixName}:\n${trimmed}`;
}

export default function ConversationsPage() {
  const businessId = useBusinessId();
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [replyText, setReplyText] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [selectedAttendantName, setSelectedAttendantName] = useState("");
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["conversations", businessId],
    queryFn: () => conversationApi.list(businessId, { page: 1 }),
    enabled: !!businessId,
    refetchInterval: 10_000,
  });
  const { data: business } = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => businessApi.get(businessId),
    enabled: !!businessId,
  });

  const {
    data: detail,
    isLoading: detailLoading,
    isError: detailError,
    refetch: refetchDetail,
  } = useQuery({
    queryKey: ["conversation-detail", businessId, selected],
    queryFn: () => (selected ? conversationApi.get(businessId, selected) : null),
    enabled: !!businessId && !!selected,
    refetchInterval: 5_000,
  });

  const attendMutation = useMutation({
    mutationFn: (convId: string) => conversationApi.attend(businessId, convId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversation-detail", businessId, selected] });
      toast.success("Atendimento assumido — a IA pausou para esta conversa.");
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (convId: string) => conversationApi.release(businessId, convId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversation-detail", businessId, selected] });
      toast.success("IA reativada para esta conversa.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (convId: string) => conversationApi.remove(businessId, convId),
    onSuccess: (_data, convId) => {
      setSelected((cur) => (cur === convId ? null : cur));
      void queryClient.invalidateQueries({ queryKey: ["conversations", businessId] });
      void queryClient.invalidateQueries({ queryKey: ["conversations-open-count", businessId] });
      void queryClient.removeQueries({ queryKey: ["conversation-detail", businessId, convId] });
      toast.success("Conversa excluída.");
    },
    onError: (err: Error) => toast.error(err.message ?? "Erro ao excluir conversa"),
  });

  function appendMessageToDetail(message: Message) {
    if (!selected) return;
    queryClient.setQueryData(
      ["conversation-detail", businessId, selected],
      (old: (Conversation & { messages: Message[] }) | null | undefined) =>
        old ? { ...old, messages: [...old.messages, message] } : old
    );
    void queryClient.invalidateQueries({ queryKey: ["conversation-detail", businessId, selected] });
    void queryClient.invalidateQueries({ queryKey: ["conversations", businessId] });
  }

  const sendMutation = useMutation({
    mutationFn: ({
      to,
      text,
      conversationId,
    }: {
      to: string;
      text: string;
      conversationId: string;
    }) => whatsappApi.send(businessId, to, text, conversationId),
    onSuccess: (data: { message?: Message }) => {
      setReplyText("");
      if (data?.message) appendMessageToDetail(data.message);
    },
    onError: (err: Error) => toast.error(err.message ?? "Erro ao enviar mensagem"),
  });

  const sendMediaMutation = useMutation({
    mutationFn: ({
      conversationId,
      file,
      caption,
    }: {
      conversationId: string;
      file: File;
      caption?: string;
    }) => whatsappApi.sendMedia(businessId, conversationId, file, caption),
    onSuccess: (data: { message?: Message }) => {
      setReplyText("");
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (data?.message) appendMessageToDetail(data.message);
    },
    onError: (err: Error) => toast.error(err.message ?? "Erro ao enviar mídia"),
  });

  const isSending = sendMutation.isPending || sendMediaMutation.isPending;

  const conversations: Conversation[] = data?.conversations ?? [];
  const filtered = conversations.filter((c) => {
    const label = formatCustomerLabel(c.customerPhone, c.customerName).toLowerCase();
    return label.includes(search.toLowerCase()) || c.customerPhone.includes(search);
  });

  const selectedConv = detail as (Conversation & { messages: Message[] }) | null | undefined;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [selectedConv?.messages]);

  function sendDest(conv: Conversation) {
    return conv.replyJid?.trim() || conv.customerPhone;
  }

  function resolveAttendantName() {
    const enabled = (business as { attendantEnabled?: boolean } | undefined)?.attendantEnabled !== false;
    if (!enabled) return "";
    const fromSelection = selectedAttendantName.trim();
    if (fromSelection) return fromSelection;
    const fromList = (business as { attendantNames?: string[] } | undefined)?.attendantNames
      ?.map((name) => name.trim())
      .find(Boolean);
    if (fromList) return fromList;
    const fromBusiness = (business as { attendantName?: string } | undefined)?.attendantName?.trim();
    if (fromBusiness) return fromBusiness;
    const fromAuth = getClientAuth().currentUser?.displayName?.trim();
    if (fromAuth) return fromAuth;
    return "Atendente";
  }

  const rawAttendantNames = (business as { attendantNames?: unknown; attendantName?: string } | undefined);
  const attendantOptions = Array.from(
    new Set(
      [
        ...(Array.isArray(rawAttendantNames?.attendantNames)
          ? rawAttendantNames.attendantNames
          : typeof rawAttendantNames?.attendantNames === "string"
          ? rawAttendantNames.attendantNames.split("\n")
          : []),
        rawAttendantNames?.attendantName ?? "",
      ]
        .map((name) => String(name).trim())
        .filter(Boolean)
    )
  );

  useEffect(() => {
    if (!attendantOptions.length) return;
    setSelectedAttendantName((current) =>
      current && attendantOptions.includes(current) ? current : attendantOptions[0]!
    );
  }, [businessId, attendantOptions.join("|")]);

  function isManualPrefixEnabled() {
    const b = business as { manualAttendantPrefixEnabled?: boolean; attendantEnabled?: boolean } | undefined;
    return b?.manualAttendantPrefixEnabled !== false && b?.attendantEnabled !== false;
  }

  function shouldApplyManualPrefix() {
    if (selectedAttendantName.trim()) return true;
    return isManualPrefixEnabled();
  }

  function submitReply(conv: Conversation) {
    if (isSending) return;
    if (pendingFile) {
      sendMediaMutation.mutate({
        conversationId: conv.id,
        file: pendingFile,
        caption: replyText.trim() || undefined,
      });
      return;
    }
    const text = buildManualMessage(replyText, resolveAttendantName(), shouldApplyManualPrefix());
    if (!text.trim()) return;
    sendMutation.mutate({
      to: sendDest(conv),
      text,
      conversationId: conv.id,
    });
  }

  return (
    <div className="flex h-full">
      <div className="w-80 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <h1 className="font-semibold text-gray-900 mb-3">Conversas</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              className="pl-9 text-sm"
              placeholder="Buscar cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-12">Nenhuma conversa</div>
          ) : (
            filtered.map((conv) => (
              <button
                key={conv.id}
                type="button"
                onClick={() => setSelected(conv.id)}
                className={cn(
                  "w-full text-left p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors",
                  selected === conv.id && "bg-brand-50 border-brand-100"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {formatCustomerLabel(conv.customerPhone, conv.customerName)}
                    </p>
                    {!conv.customerName && conv.customerPhone.includes("@lid") ? (
                      <p className="text-xs text-gray-400 truncate">WhatsApp</p>
                    ) : null}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <Badge variant="secondary" className={cn("text-xs", STATUS_LABELS[conv.status]?.color)}>
                      {STATUS_LABELS[conv.status]?.label}
                    </Badge>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDistanceToNow(new Date(conv.lastMessageAt), { locale: ptBR, addSuffix: true })}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-gray-50">
        {selected && detailLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          </div>
        ) : selected && detailError ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
            <p className="text-sm text-gray-600">Não foi possível carregar esta conversa.</p>
            <Button type="button" variant="outline" onClick={() => void refetchDetail()}>
              Tentar novamente
            </Button>
          </div>
        ) : selectedConv ? (
          <>
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">
                  {formatCustomerLabel(selectedConv.customerPhone, selectedConv.customerName)}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className={STATUS_LABELS[selectedConv.status]?.color}>
                  {STATUS_LABELS[selectedConv.status]?.label}
                </Badge>
                {selectedConv.status === "OPEN" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => attendMutation.mutate(selectedConv.id)}
                    disabled={attendMutation.isPending}
                  >
                    <User className="w-3 h-3" />
                    Assumir atendimento
                  </Button>
                )}
                {selectedConv.status === "ATTENDING" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => releaseMutation.mutate(selectedConv.id)}
                    disabled={releaseMutation.isPending}
                  >
                    <IaIcon className="w-3 h-3" />
                    Devolver à IA
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    const label = formatCustomerLabel(
                      selectedConv.customerPhone,
                      selectedConv.customerName
                    );
                    if (
                      !confirm(
                        `Excluir a conversa com ${label}? Todas as mensagens serão apagadas. Esta ação não pode ser desfeita.`
                      )
                    ) {
                      return;
                    }
                    deleteMutation.mutate(selectedConv.id);
                  }}
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                  Excluir
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {selectedConv.messages?.map((msg) => (
                <div
                  key={msg.id}
                  className={cn("flex", msg.role === "CUSTOMER" ? "justify-start" : "justify-end")}
                >
                  <div
                    className={cn(
                      "max-w-sm rounded-2xl px-4 py-2.5 text-sm",
                      msg.role === "CUSTOMER"
                        ? "bg-white border border-gray-200 text-gray-900 rounded-tl-sm"
                        : isIaMessageRole(msg.role)
                        ? "bg-brand-600 text-white rounded-tr-sm"
                        : "bg-blue-600 text-white rounded-tr-sm"
                    )}
                  >
                    {msg.role !== "CUSTOMER" && (
                      <p className="text-xs opacity-70 mb-1 flex items-center gap-1">
                        {isIaMessageRole(msg.role) ? (
                          <>
                            <IaIcon className="w-3 h-3" /> {IA_DISPLAY_NAME}
                          </>
                        ) : (
                          <>
                            <User className="w-3 h-3" /> Você
                          </>
                        )}
                      </p>
                    )}
                    <ConversationMessageBody msg={msg} />
                    <p className="text-xs opacity-60 mt-1 text-right">
                      {new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {selectedConv.status === "ATTENDING" && (
              <div className="bg-white border-t border-gray-200 p-4">
                {attendantOptions.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-1">Atendente desta conversa</p>
                    <select
                      value={selectedAttendantName}
                      onChange={(e) => setSelectedAttendantName(e.target.value)}
                      className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-700"
                    >
                      {attendantOptions.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {pendingFile && (
                  <div className="mb-3 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    <span className="truncate flex-1">{pendingFile.name}</span>
                    <button
                      type="button"
                      className="text-gray-400 hover:text-gray-600"
                      onClick={() => {
                        setPendingFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,audio/ogg,audio/mpeg,audio/mp4,audio/aac,audio/webm"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setPendingFile(file);
                  }}
                />
                <div className="flex items-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 shrink-0"
                    disabled={isSending}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Textarea
                    className="min-h-20 flex-1 resize-none text-sm"
                    placeholder={pendingFile ? "Legenda (opcional)..." : "Digite sua mensagem..."}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void submitReply(selectedConv);
                      }
                    }}
                  />
                  <Button
                    className="h-10 shrink-0"
                    disabled={(!replyText.trim() && !pendingFile) || isSending}
                    onClick={() => void submitReply(selectedConv)}
                  >
                    {isSending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Enter para enviar • Shift+Enter para nova linha • Anexe imagem, vídeo ou áudio
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Selecione uma conversa para visualizar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

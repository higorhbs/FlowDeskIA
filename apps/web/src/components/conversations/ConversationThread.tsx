"use client";

import { useEffect, useRef, useState } from "react";
import type { Business, Message } from "@flowdesk/firebase/client";
import { getClientAuth } from "@flowdesk/firebase/client";
import { Loader2, MessageSquare, Paperclip, Send, Trash2, User, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { IaIcon, IA_DISPLAY_NAME, isIaMessageRole } from "@/lib/ia-brand";
import { formatCustomerLabel, STATUS_LABELS, cn } from "@/lib/utils";
import type { ConversationDetail } from "@/lib/server/data/conversations";
import { ConversationMessageBody } from "./ConversationMessageBody";
import { buildManualMessage } from "./conversation-utils";

type ConversationThreadProps = {
  business: Business;
  businessId: string;
  selectedId: string | null;
  conversation: ConversationDetail | null | undefined;
  detailLoading: boolean;
  detailError: boolean;
  onRefetchDetail: () => void;
  onAttend: (convId: string) => void;
  onRelease: (convId: string) => void;
  onDelete: (convId: string) => void;
  attendPending: boolean;
  releasePending: boolean;
  deletePending: boolean;
  onSendText: (conv: ConversationDetail, text: string) => void;
  onSendMedia: (conv: ConversationDetail, file: File, caption?: string) => void;
  isSending: boolean;
};

export function ConversationThread({
  business,
  businessId,
  selectedId,
  conversation,
  detailLoading,
  detailError,
  onRefetchDetail,
  onAttend,
  onRelease,
  onDelete,
  attendPending,
  releasePending,
  deletePending,
  onSendText,
  onSendMedia,
  isSending,
}: ConversationThreadProps) {
  const [replyText, setReplyText] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [selectedAttendantName, setSelectedAttendantName] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const attendantNamesEnabled = business.attendantEnabled !== false;
  const rawAttendantNames = business.attendantNames;
  const attendantOptions = Array.from(
    new Set(
      [...(rawAttendantNames ?? []), business.attendantName ?? ""]
        .map((name) => String(name).trim())
        .filter(Boolean),
    ),
  );

  useEffect(() => {
    if (!attendantOptions.length) return;
    setSelectedAttendantName((current) =>
      current && attendantOptions.includes(current) ? current : attendantOptions[0]!,
    );
  }, [businessId, attendantOptions.join("|")]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [conversation?.messages]);

  function resolveAttendantName() {
    if (business.attendantEnabled === false) return "";
    const fromSelection = selectedAttendantName.trim();
    if (fromSelection) return fromSelection;
    const fromList = business.attendantNames
      ?.map((name) => name.trim())
      .find(Boolean);
    if (fromList) return fromList;
    const fromBusiness = business.attendantName?.trim();
    if (fromBusiness) return fromBusiness;
    const fromAuth = getClientAuth().currentUser?.displayName?.trim();
    if (fromAuth) return fromAuth;
    return "Atendente";
  }

  function isManualPrefixEnabled() {
    return business.manualAttendantPrefixEnabled !== false && business.attendantEnabled !== false;
  }

  function shouldApplyManualPrefix() {
    if (!attendantNamesEnabled) return false;
    if (selectedAttendantName.trim()) return true;
    return isManualPrefixEnabled();
  }

  function submitReply(conv: ConversationDetail) {
    if (isSending) return;
    if (pendingFile) {
      onSendMedia(conv, pendingFile, replyText.trim() || undefined);
      setReplyText("");
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const text = buildManualMessage(replyText, resolveAttendantName(), shouldApplyManualPrefix());
    if (!text.trim()) return;
    onSendText(conv, text);
    setReplyText("");
  }

  if (!selectedId) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center overflow-hidden bg-gray-50">
        <div className="text-center text-gray-400">
          <MessageSquare className="mx-auto mb-3 h-12 w-12 opacity-30" />
          <p>Selecione uma conversa para visualizar</p>
        </div>
      </div>
    );
  }

  if (detailLoading && !conversation) {
    return <div className="flex h-full min-h-0 flex-1 items-center justify-center overflow-hidden bg-gray-50" />;
  }

  if (detailError && !conversation) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-hidden bg-gray-50 px-6 text-center">
        <p className="text-sm text-gray-600">Não foi possível carregar esta conversa.</p>
        <Button type="button" variant="outline" onClick={() => void onRefetchDetail()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center overflow-hidden bg-gray-50">
        <div className="text-center text-gray-400">
          <MessageSquare className="mx-auto mb-3 h-12 w-12 opacity-30" />
          <p>Selecione uma conversa para visualizar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-gray-50">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <h2 className="font-semibold text-gray-900">
          {formatCustomerLabel(conversation.customerPhone, conversation.customerName)}
        </h2>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={STATUS_LABELS[conversation.status]?.color}>
            {STATUS_LABELS[conversation.status]?.label}
          </Badge>
          {conversation.status === "OPEN" && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => onAttend(conversation.id)}
              disabled={attendPending}
            >
              <User className="h-3 w-3" />
              Assumir atendimento
            </Button>
          )}
          {conversation.status === "ATTENDING" && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => onRelease(conversation.id)}
              disabled={releasePending}
            >
              <IaIcon className="h-3 w-3" />
              Devolver à IA
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            disabled={deletePending}
            onClick={() => {
              const label = formatCustomerLabel(conversation.customerPhone, conversation.customerName);
              if (
                !confirm(
                  `Excluir a conversa com ${label}? Todas as mensagens serão apagadas. Esta ação não pode ser desfeita.`,
                )
              ) {
                return;
              }
              onDelete(conversation.id);
            }}
          >
            {deletePending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            Excluir
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-6">
        {conversation.messages?.map((msg: Message) => (
          <div key={msg.id} className={cn("flex", msg.role === "CUSTOMER" ? "justify-start" : "justify-end")}>
            <div
              className={cn(
                "max-w-sm min-w-0 rounded-2xl px-4 py-2.5 text-sm",
                msg.role === "CUSTOMER"
                  ? "rounded-tl-sm border border-gray-200 bg-white text-gray-900"
                  : isIaMessageRole(msg.role)
                    ? "rounded-tr-sm bg-brand-600 text-white"
                    : "rounded-tr-sm bg-blue-600 text-white",
              )}
            >
              {msg.role !== "CUSTOMER" && (
                <p className="mb-1 flex items-center gap-1 text-xs opacity-70">
                  {isIaMessageRole(msg.role) ? (
                    <>
                      <IaIcon className="h-3 w-3" /> {IA_DISPLAY_NAME}
                    </>
                  ) : (
                    <>
                      <User className="h-3 w-3" /> Você
                    </>
                  )}
                </p>
              )}
              <ConversationMessageBody msg={msg} />
              <p className="mt-1 text-right text-xs opacity-60">
                {new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {conversation.status === "ATTENDING" && (
        <div className="shrink-0 border-t border-gray-200 bg-white p-4">
          {attendantNamesEnabled && attendantOptions.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-xs text-gray-500">Atendente desta conversa</p>
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
              <span className="flex-1 truncate">{pendingFile.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="text-gray-400 hover:text-gray-600"
                onClick={() => {
                  setPendingFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                <X className="h-4 w-4" />
              </Button>
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
              <Paperclip className="h-4 w-4" />
            </Button>
            <Textarea
              className="min-h-20 flex-1 resize-none text-sm"
              placeholder={pendingFile ? "Legenda (opcional)..." : "Digite sua mensagem..."}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submitReply(conversation);
                }
              }}
            />
            <Button
              className="h-10 shrink-0"
              disabled={(!replyText.trim() && !pendingFile) || isSending}
              onClick={() => void submitReply(conversation)}
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Enter para enviar • Shift+Enter para nova linha • Anexe imagem, vídeo ou áudio
          </p>
        </div>
      )}
    </div>
  );
}

"use client";

import type { Message } from "@flowdesk/firebase/client";
import { resolveChatMediaUrl } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AudioPlayer } from "./AudioPlayer";
import { CollapsibleMessageText } from "./CollapsibleMessageText";
import { isMediaPlaceholderOnly, shouldShowMessageText } from "./conversation-utils";

function MessageButtons({ buttons, isOwn }: { buttons: Message["buttons"]; isOwn: boolean }) {
  if (!buttons?.length) return null;
  return (
    <div className={cn("mt-2 -mx-1 space-y-1", isOwn ? "border-t border-white/20 pt-2" : "border-t border-gray-200 pt-2")}>
      {buttons.map((btn) => (
        <div
          key={btn.id}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium",
            isOwn ? "bg-white/15 text-white" : "bg-gray-50 text-brand-600",
          )}
        >
          <span className="text-[10px] opacity-70" aria-hidden>
            ↩
          </span>
          <span className="truncate">{btn.label}</span>
        </div>
      ))}
    </div>
  );
}

export function ConversationMessageBody({ msg }: { msg: Message }) {
  const hasMedia = Boolean(msg.mediaUrl && msg.mediaType);
  const isOwn = msg.role !== "CUSTOMER";
  return (
    <>
      {hasMedia && (msg.mediaType === "image" || msg.mediaType === "gif") && (
        <a
          href={resolveChatMediaUrl(msg.mediaUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="block mb-2"
        >
          <img
            src={resolveChatMediaUrl(msg.mediaUrl)}
            alt=""
            className="max-w-full max-h-48 rounded-lg object-cover"
          />
        </a>
      )}
      {hasMedia && msg.mediaType === "video" && (
        <video
          src={resolveChatMediaUrl(msg.mediaUrl)}
          controls
          className="max-w-full max-h-64 rounded-lg mb-2"
        />
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
        <CollapsibleMessageText content={msg.content} isOwn={isOwn} />
      )}
      <MessageButtons buttons={msg.buttons} isOwn={isOwn} />
    </>
  );
}

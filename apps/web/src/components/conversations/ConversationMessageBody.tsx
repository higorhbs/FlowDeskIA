"use client";

import type { Message } from "@flowdesk/firebase/client";
import { resolveChatMediaUrl } from "@/lib/api";
import { AudioPlayer } from "./AudioPlayer";
import { CollapsibleMessageText } from "./CollapsibleMessageText";
import { isMediaPlaceholderOnly, shouldShowMessageText } from "./conversation-utils";

export function ConversationMessageBody({ msg }: { msg: Message }) {
  const hasMedia = Boolean(msg.mediaUrl && msg.mediaType);
  const isOwn = msg.role !== "CUSTOMER";
  return (
    <>
      {hasMedia && msg.mediaType === "image" && (
        <a
          href={resolveChatMediaUrl(msg.mediaUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="block mb-2"
        >
          <img
            src={resolveChatMediaUrl(msg.mediaUrl)}
            alt=""
            className="max-w-full max-h-64 rounded-lg object-cover"
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
    </>
  );
}

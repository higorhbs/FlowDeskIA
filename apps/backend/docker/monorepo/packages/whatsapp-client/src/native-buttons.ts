import {
  generateMessageIDV2,
  generateWAMessageFromContent,
  isJidGroup,
  normalizeMessageContent,
  type BinaryNode,
  type proto,
  type WASocket,
} from "@whiskeysockets/baileys";
import { getButtonArgs, getButtonType } from "@ryuu-reinzz/button-helper";

type QuickButton = { id: string; label: string };

function buildInteractiveButtons(buttons: QuickButton[]) {
  return buttons.slice(0, 3).map((b, i) => ({
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: b.label.slice(0, 20),
      id: b.id || `btn_${i + 1}`,
    }),
  }));
}

function toInteractiveContent(text: string, footer: string | undefined, buttons: QuickButton[]) {
  const interactiveButtons = buildInteractiveButtons(buttons);
  return {
    interactiveMessage: {
      nativeFlowMessage: {
        buttons: interactiveButtons,
      },
      body: text.trim() ? { text: text.trim() } : undefined,
      footer: footer?.trim() ? { text: footer.trim() } : undefined,
    },
  } satisfies proto.IMessage;
}

export async function sendNativeButtons(
  sock: WASocket,
  jid: string,
  text: string,
  buttons: QuickButton[],
  footer?: string,
): Promise<proto.IWebMessageInfo> {
  if (!sock?.relayMessage) throw new Error("Socket relayMessage unavailable");

  const content = toInteractiveContent(text, footer, buttons);
  const userJid = sock.authState?.creds?.me?.id || sock.user?.id || "";
  const fullMsg = generateWAMessageFromContent(jid, content, {
    userJid,
    messageId: generateMessageIDV2(userJid || undefined),
    timestamp: new Date(),
  });

  const normalizedContent = normalizeMessageContent(fullMsg.message);
  const normalizedRecord = normalizedContent as Record<string, unknown> | undefined;
  const buttonType = normalizedRecord ? getButtonType(normalizedRecord) : null;
  const additionalNodes: BinaryNode[] = [];

  if (buttonType && normalizedRecord) {
    additionalNodes.push(getButtonArgs(normalizedRecord) as BinaryNode);
    if (!isJidGroup(jid)) {
      additionalNodes.push({ tag: "bot", attrs: { biz_bot: "1" } });
    }
  }

  await sock.relayMessage(jid, fullMsg.message!, {
    messageId: fullMsg.key!.id!,
    additionalNodes,
  });

  return fullMsg;
}

export type ListRow = { id: string; title: string; description?: string };
export type ListSection = { title?: string; rows: ListRow[] };

function buildSingleSelectButton(buttonText: string, sections: ListSection[]) {
  return [
    {
      name: "single_select",
      buttonParamsJson: JSON.stringify({
        title: buttonText.slice(0, 20),
        sections: sections.map((s) => ({
          title: s.title,
          rows: s.rows.map((r) => ({
            title: r.title,
            description: r.description ?? "",
            id: r.id,
          })),
        })),
      }),
    },
  ];
}

function toListContent(
  text: string,
  footer: string | undefined,
  buttonText: string,
  sections: ListSection[],
) {
  return {
    interactiveMessage: {
      nativeFlowMessage: {
        buttons: buildSingleSelectButton(buttonText, sections),
      },
      body: text.trim() ? { text: text.trim() } : undefined,
      footer: footer?.trim() ? { text: footer.trim() } : undefined,
    },
  } satisfies proto.IMessage;
}

export async function sendNativeList(
  sock: WASocket,
  jid: string,
  text: string,
  buttonText: string,
  sections: ListSection[],
  footer?: string,
): Promise<proto.IWebMessageInfo> {
  if (!sock?.relayMessage) throw new Error("Socket relayMessage unavailable");

  const content = toListContent(text, footer, buttonText, sections);
  const userJid = sock.authState?.creds?.me?.id || sock.user?.id || "";
  const fullMsg = generateWAMessageFromContent(jid, content, {
    userJid,
    messageId: generateMessageIDV2(userJid || undefined),
    timestamp: new Date(),
  });

  const normalizedContent = normalizeMessageContent(fullMsg.message);
  const normalizedRecord = normalizedContent as Record<string, unknown> | undefined;
  const buttonType = normalizedRecord ? getButtonType(normalizedRecord) : null;
  const additionalNodes: BinaryNode[] = [];

  if (buttonType && normalizedRecord) {
    additionalNodes.push(getButtonArgs(normalizedRecord) as BinaryNode);
    if (!isJidGroup(jid)) {
      additionalNodes.push({ tag: "bot", attrs: { biz_bot: "1" } });
    }
  }

  await sock.relayMessage(jid, fullMsg.message!, {
    messageId: fullMsg.key!.id!,
    additionalNodes,
  });

  return fullMsg;
}

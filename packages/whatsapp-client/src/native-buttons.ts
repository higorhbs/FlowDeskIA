import type { proto, WASocket } from "@whiskeysockets/baileys";
import { sendButtons as helperSendButtons } from "@ryuu-reinzz/button-helper";

type QuickButton = { id: string; label: string };

export async function sendNativeButtons(
  sock: WASocket,
  jid: string,
  text: string,
  buttons: QuickButton[],
  footer?: string,
): Promise<proto.IWebMessageInfo> {
  if (!sock) throw new Error("Socket unavailable");

  const items = buttons.slice(0, 3).map((b, i) => ({
    id: b.id || `btn_${i + 1}`,
    text: b.label.slice(0, 20),
  }));

  const body = text.trim();
  return helperSendButtons(sock, jid, {
    text: body || " ",
    footer: footer?.trim() || (body ? undefined : "Toque em uma opção"),
    buttons: items,
  }) as Promise<proto.IWebMessageInfo>;
}

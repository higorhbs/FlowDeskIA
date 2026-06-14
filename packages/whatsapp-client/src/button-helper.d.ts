declare module "@ryuu-reinzz/button-helper" {
  import type { WAMessage, WASocket } from "@whiskeysockets/baileys";

  export function sendButtons(
    sock: WASocket,
    jid: string,
    data: {
      text: string;
      footer?: string;
      title?: string;
      subtitle?: string;
      buttons: Array<{ id: string; text: string } | Record<string, unknown>>;
    },
    options?: Record<string, unknown>,
  ): Promise<WAMessage>;
}

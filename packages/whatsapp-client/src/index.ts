import makeWASocket, {
  DisconnectReason,
  extractMessageContent,
  fetchLatestBaileysVersion,
  isJidBroadcast,
  isJidGroup,
  isJidNewsletter,
  isJidStatusBroadcast,
  jidNormalizedUser,
  makeCacheableSignalKeyStore,
  proto,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import NodeCache from "@cacheable/node-cache";
import { Boom } from "@hapi/boom";
import pino from "pino";
import { toDataURL } from "qrcode";
import path from "path";
import fs from "fs";
import EventEmitter from "events";

export interface WhatsAppMessage {
  from: string;
  replyJid: string;
  body: string;
  messageId: string;
  timestamp: number;
  isGroup: boolean;
  pushName?: string;
}

export type ConnectionStatus = "connecting" | "open" | "close" | "qr";

function messageStoreKey(key: proto.IMessageKey): string {
  return `${key.remoteJid ?? ""}|${key.id ?? ""}|${key.fromMe ? 1 : 0}`;
}

function pnToJid(pn: string): string {
  const digits = pn.replace(/\D/g, "");
  if (!digits) return pn;
  return digits.includes("@") ? jidNormalizedUser(pn) || pn : `${digits}@s.whatsapp.net`;
}

function resolveReplyJid(remoteJid: string): string {
  return jidNormalizedUser(remoteJid) || remoteJid;
}

function resolveCustomerJid(key: proto.IMessageKey, remoteJid: string): string {
  const extended = key as proto.IMessageKey & { senderPn?: string; participantPn?: string };
  const pn = extended.senderPn || extended.participantPn;
  if (pn) return pnToJid(pn);
  return resolveReplyJid(remoteJid);
}

function shouldSkipJid(jid: string): boolean {
  return (
    isJidGroup(jid) ||
    isJidBroadcast(jid) ||
    isJidStatusBroadcast(jid) ||
    isJidNewsletter(jid) ||
    jid.endsWith("@bot")
  );
}

function extractBody(message: proto.IMessage | null | undefined): string {
  const content = extractMessageContent(message ?? undefined);
  if (!content) return "";
  const text =
    content.conversation ??
    content.extendedTextMessage?.text ??
    content.imageMessage?.caption ??
    content.videoMessage?.caption ??
    content.documentMessage?.caption ??
    content.buttonsResponseMessage?.selectedButtonId ??
    content.listResponseMessage?.singleSelectReply?.selectedRowId ??
    content.templateButtonReplyMessage?.selectedId ??
    "";
  if (text.trim()) return text.trim();
  if (content.imageMessage) return "[imagem]";
  if (content.videoMessage) return "[video]";
  if (content.audioMessage) return "[audio]";
  if (content.documentMessage) return "[documento]";
  if (content.stickerMessage) return "[sticker]";
  if (content.locationMessage || content.liveLocationMessage) return "[localizacao]";
  if (content.contactMessage || content.contactsArrayMessage) return "[contato]";
  return "";
}

export class WhatsAppClient extends EventEmitter {
  private sock: WASocket | null = null;
  private sessionPath: string;
  private logger = pino({ level: "silent" });
  private messageStore = new Map<string, proto.IMessage>();
  private msgRetryCounterCache = new NodeCache({ stdTTL: 600, useClones: false });
  public status: ConnectionStatus = "close";
  public lastQrDataUrl?: string;
  private connecting = false;

  constructor(private businessId: string, sessionsRoot: string) {
    super();
    this.sessionPath = path.join(sessionsRoot, businessId);
    fs.mkdirSync(this.sessionPath, { recursive: true });
  }

  async connect() {
    if (this.status === "open") return;
    if (this.connecting) return;
    this.connecting = true;
    this.status = "connecting";
    try {
      if (this.sock) {
        try {
          this.sock.ev.removeAllListeners("connection.update");
          this.sock.ev.removeAllListeners("creds.update");
          this.sock.ev.removeAllListeners("messages.upsert");
          this.sock.end(undefined);
        } catch {
          /* ignore */
        }
        this.sock = null;
        this.status = "close";
      }

      const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);
      let version: [number, number, number];
      try {
        const latest = await fetchLatestBaileysVersion();
        version = latest.version as [number, number, number];
      } catch {
        version = [2, 3000, 1015901307];
      }

      this.sock = makeWASocket({
        version,
        logger: this.logger as any,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, this.logger as any),
        },
        printQRInTerminal: false,
        generateHighQualityLinkPreview: false,
        markOnlineOnConnect: false,
        msgRetryCounterCache: this.msgRetryCounterCache as any,
        getMessage: async (key) => this.messageStore.get(messageStoreKey(key)),
      });

      this.sock.ev.on("creds.update", saveCreds);

      this.sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.status = "qr";
          const qrDataUrl = await toDataURL(qr);
          this.lastQrDataUrl = qrDataUrl;
          this.emit("qr", qrDataUrl);
        }

        if (connection === "open") {
          this.status = "open";
          this.lastQrDataUrl = undefined;
          this.connecting = false;
          this.emit("connected");
        }

        if (connection === "close") {
          this.status = "close";
          this.connecting = false;
          const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = code !== DisconnectReason.loggedOut;
          this.emit("disconnected", { code, shouldReconnect });
          if (shouldReconnect) {
            setTimeout(() => {
              void this.connect().catch(() => undefined);
            }, 2500);
          }
        }
      });

      this.sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;

        for (const msg of messages) {
          if (msg.key.fromMe) continue;
          if (shouldSkipJid(msg.key.remoteJid ?? "")) continue;

          const remoteJid = resolveReplyJid(msg.key.remoteJid ?? "");
          if (!remoteJid || shouldSkipJid(remoteJid)) continue;

          if (msg.message && msg.key.id) {
            this.messageStore.set(messageStoreKey(msg.key), msg.message);
          }

          const body = extractBody(msg.message);
          if (!body) continue;

          const parsed: WhatsAppMessage = {
            from: resolveCustomerJid(msg.key, remoteJid),
            replyJid: remoteJid,
            body,
            messageId: msg.key.id ?? "",
            timestamp: (msg.messageTimestamp as number) ?? Date.now() / 1000,
            isGroup: !!isJidGroup(remoteJid),
            pushName: msg.pushName ?? undefined,
          };

          this.emit("message", parsed);
        }
      });
    } catch (err) {
      this.connecting = false;
      throw err;
    }
  }

  async sendText(to: string, text: string): Promise<string | undefined> {
    if (!this.sock) throw new Error("Socket not connected");
    const jid = resolveReplyJid(to.includes("@") ? to : `${to}@s.whatsapp.net`);
    const result = await this.sock.sendMessage(jid, { text });
    return result?.key.id ?? undefined;
  }

  async sendImage(to: string, imageUrl: string, caption?: string): Promise<string | undefined> {
    if (!this.sock) throw new Error("Socket not connected");
    const jid = resolveReplyJid(to.includes("@") ? to : `${to}@s.whatsapp.net`);
    const result = await this.sock.sendMessage(jid, {
      image: { url: imageUrl },
      caption,
    });
    return result?.key.id ?? undefined;
  }

  async logout() {
    await this.sock?.logout();
    this.sock = null;
    this.status = "close";
    this.messageStore.clear();
    fs.rmSync(this.sessionPath, { recursive: true, force: true });
  }

  isConnected(): boolean {
    return this.status === "open";
  }
}

export class WhatsAppManager {
  private clients = new Map<string, WhatsAppClient>();

  getOrCreate(businessId: string, sessionsRoot: string): WhatsAppClient {
    if (!this.clients.has(businessId)) {
      const client = new WhatsAppClient(businessId, sessionsRoot);
      this.clients.set(businessId, client);
    }
    return this.clients.get(businessId)!;
  }

  get(businessId: string): WhatsAppClient | undefined {
    return this.clients.get(businessId);
  }

  remove(businessId: string) {
    this.clients.delete(businessId);
  }

  all(): Map<string, WhatsAppClient> {
    return this.clients;
  }
}

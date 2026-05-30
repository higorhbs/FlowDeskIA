import makeWASocket, {
  DisconnectReason,
  extractMessageContent,
  fetchLatestBaileysVersion,
  isJidBroadcast,
  isJidGroup,
  isJidNewsletter,
  isJidStatusBroadcast,
  isLidUser,
  jidNormalizedUser,
  makeCacheableSignalKeyStore,
  proto,
  useMultiFileAuthState,
  type WAMessage,
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

type MsgKey = proto.IMessageKey;

function messageStoreKey(key: MsgKey): string {
  return `${key.remoteJid ?? ""}|${key.id ?? ""}|${key.fromMe ? 1 : 0}`;
}

function pnToJid(pn: string): string {
  const raw = pn.trim();
  if (raw.includes("@")) return jidNormalizedUser(raw) || raw;
  const digits = raw.replace(/\D/g, "");
  return digits ? `${digits}@s.whatsapp.net` : raw;
}

function toSendJid(jid: string): string {
  if (!jid.includes("@")) return `${jid.replace(/\D/g, "")}@s.whatsapp.net`;
  if (isLidUser(jid)) return jid;
  return jidNormalizedUser(jid) || jid;
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

function resolveAddress(key: MsgKey, remoteJid: string, lidToPhone: Map<string, string>) {
  const extended = key as MsgKey & { senderPn?: string; participantPn?: string };
  const pn = extended.senderPn || extended.participantPn;
  if (pn) {
    const phoneJid = pnToJid(pn);
    return { from: phoneJid, replyJid: phoneJid };
  }

  const normalized = toSendJid(remoteJid);
  if (isLidUser(normalized)) {
    const mapped = lidToPhone.get(normalized);
    if (mapped) return { from: mapped, replyJid: mapped };
    return { from: normalized, replyJid: normalized };
  }

  return { from: normalized, replyJid: normalized };
}

function extractBody(message: proto.IMessage | null | undefined): string {
  const content = extractMessageContent(message ?? undefined);
  if (!content) return "";
  if (content.protocolMessage && !content.conversation && !content.extendedTextMessage) return "";

  const text =
    content.conversation ??
    content.extendedTextMessage?.text ??
    content.imageMessage?.caption ??
    content.videoMessage?.caption ??
    content.documentMessage?.caption ??
    content.buttonsResponseMessage?.selectedButtonId ??
    content.listResponseMessage?.singleSelectReply?.selectedRowId ??
    content.templateButtonReplyMessage?.selectedId ??
    content.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ??
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
  private logger = pino({
    level: process.env.WA_LOG_LEVEL?.trim() || "warn",
  });
  private messageStore = new Map<string, proto.IMessage>();
  private msgRetryCounterCache = new NodeCache({ stdTTL: 600, useClones: false });
  private seenInboundIds = new NodeCache({ stdTTL: 300, useClones: false });
  private lidToPhone = new Map<string, string>();
  public status: ConnectionStatus = "close";
  public lastQrDataUrl?: string;
  private connecting = false;

  constructor(
    private businessId: string,
    sessionsRoot: string
  ) {
    super();
    this.sessionPath = path.join(sessionsRoot, businessId);
    fs.mkdirSync(this.sessionPath, { recursive: true });
  }

  private logSkip(reason: string, key: MsgKey) {
    this.logger.warn(
      { businessId: this.businessId, reason, remoteJid: key.remoteJid, id: key.id },
      "whatsapp inbound skipped"
    );
  }

  private tryEmitInbound(msg: WAMessage) {
    if (msg.key.fromMe) return;
    const rawJid = msg.key.remoteJid ?? "";
    if (!rawJid || shouldSkipJid(rawJid)) {
      this.logSkip("skip_jid", msg.key);
      return;
    }

    const messageId = msg.key.id ?? "";
    if (messageId && this.seenInboundIds.has(messageId)) return;
    if (messageId) this.seenInboundIds.set(messageId, true);

    if (msg.message && messageId) {
      this.messageStore.set(messageStoreKey(msg.key), msg.message);
    }

    const body = extractBody(msg.message);
    if (!body) {
      this.logSkip("empty_body", msg.key);
      return;
    }

    const { from, replyJid } = resolveAddress(msg.key, rawJid, this.lidToPhone);
    const parsed: WhatsAppMessage = {
      from,
      replyJid,
      body,
      messageId,
      timestamp: Number(msg.messageTimestamp) || Math.floor(Date.now() / 1000),
      isGroup: !!isJidGroup(rawJid),
      pushName: msg.pushName ?? undefined,
    };

    this.logger.info(
      { businessId: this.businessId, from: parsed.from, replyJid: parsed.replyJid, body: parsed.body.slice(0, 80) },
      "whatsapp inbound"
    );
    this.emit("message", parsed);
  }

  private bindSocketEvents(saveCreds: () => Promise<void>) {
    if (!this.sock) return;

    this.sock.ev.on("creds.update", saveCreds);

    this.sock.ev.on("chats.phoneNumberShare", ({ lid, jid }) => {
      const lidJid = toSendJid(lid);
      const phoneJid = pnToJid(jid);
      if (lidJid && phoneJid) this.lidToPhone.set(lidJid, phoneJid);
    });

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
        this.logger.info({ businessId: this.businessId }, "whatsapp connected");
        this.emit("connected");
      }

      if (connection === "close") {
        this.status = "close";
        this.connecting = false;
        const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = code !== DisconnectReason.loggedOut;
        this.logger.warn({ businessId: this.businessId, code, shouldReconnect }, "whatsapp disconnected");
        this.emit("disconnected", { code, shouldReconnect });
        if (shouldReconnect) {
          setTimeout(() => {
            void this.connect().catch(() => undefined);
          }, 2500);
        }
      }
    });

    this.sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify" && type !== "append") return;
      for (const msg of messages) this.tryEmitInbound(msg);
    });

    this.sock.ev.on("messages.update", async (updates) => {
      for (const { key, update } of updates) {
        if (!key?.remoteJid || key.fromMe || !update.message) continue;
        this.tryEmitInbound({ key, message: update.message, messageTimestamp: Date.now() / 1000 });
      }
    });
  }

  async connect() {
    if (this.status === "open") return;
    if (this.connecting) return;
    this.connecting = true;
    this.status = "connecting";
    try {
      if (this.sock) {
        try {
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

      this.bindSocketEvents(saveCreds);
    } catch (err) {
      this.connecting = false;
      throw err;
    }
  }

  async sendText(to: string, text: string): Promise<string | undefined> {
    if (!this.sock) throw new Error("Socket not connected");
    const jid = toSendJid(to);
    const result = await this.sock.sendMessage(jid, { text });
    return result?.key.id ?? undefined;
  }

  async sendImage(to: string, imageUrl: string, caption?: string): Promise<string | undefined> {
    if (!this.sock) throw new Error("Socket not connected");
    const jid = toSendJid(to);
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
    this.lidToPhone.clear();
    fs.rmSync(this.sessionPath, { recursive: true, force: true });
  }

  isConnected(): boolean {
    return this.status === "open";
  }

  getDebugInfo() {
    return {
      businessId: this.businessId,
      status: this.status,
      messageHandlers: this.listenerCount("message"),
      lidMappings: this.lidToPhone.size,
    };
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

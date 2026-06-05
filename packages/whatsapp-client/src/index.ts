import makeWASocket, {
  DisconnectReason,
  downloadMediaMessage,
  extractMessageContent,
  fetchLatestBaileysVersion,
  getContentType,
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

export type { WAMessage };
import NodeCache from "@cacheable/node-cache";
import { Boom } from "@hapi/boom";
import pino from "pino";
import { toDataURL } from "qrcode";
import path from "path";
import fs from "fs";
import EventEmitter from "events";

export type WhatsAppMediaType = "image" | "video" | "audio";

export interface WhatsAppMessage {
  from: string;
  replyJid: string;
  body: string;
  messageId: string;
  timestamp: number;
  isGroup: boolean;
  pushName?: string;
  mediaType?: WhatsAppMediaType;
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

  const type = getContentType(content);
  if (type === "conversation") return content.conversation?.trim() ?? "";
  if (type === "extendedTextMessage") return content.extendedTextMessage?.text?.trim() ?? "";

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

export function detectMediaType(
  message: proto.IMessage | null | undefined
): WhatsAppMediaType | undefined {
  const content = extractMessageContent(message ?? undefined);
  if (!content) return undefined;
  if (content.imageMessage || content.stickerMessage) return "image";
  if (content.videoMessage) return "video";
  if (content.ptvMessage) return "video";
  if (content.audioMessage) return "audio";
  return undefined;
}

function socketIsOpen(sock: WASocket | null): boolean {
  if (!sock) return false;
  const client = (sock as unknown as { ws?: { isOpen?: boolean } }).ws;
  if (!client) return true;
  return client.isOpen === true;
}

function isStatusAudienceJid(jid: string): boolean {
  if (!jid) return false;
  if (isLidUser(jid)) return true;
  return jid.endsWith("@s.whatsapp.net");
}

async function prepareStatusImage(buffer: Buffer) {
  const sharp = (await import("sharp")).default;
  const base = sharp(buffer, { failOn: "none" }).rotate();
  const meta = await base.metadata();
  const width = meta.width ?? undefined;
  const height = meta.height ?? undefined;
  const jpeg = await base.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  const thumbBuf = await sharp(jpeg).resize(32, 32, { fit: "inside" }).jpeg({ quality: 55 }).toBuffer();
  return {
    buffer: jpeg,
    mimetype: "image/jpeg",
    width,
    height,
    jpegThumbnail: thumbBuf.toString("base64"),
  };
}

function formatPublishStatusError(err: unknown): Error {
  const boom = err as { message?: string; output?: { statusCode?: number; payload?: { message?: string } } };
  const msg = boom?.message ?? (err instanceof Error ? err.message : "");
  const code = boom?.output?.statusCode;
  if (msg === "not-acceptable" || code === 406 || code === 428) {
    return new Error(
      "WhatsApp recusou o status (mídia ou destinatários). Use foto JPEG/PNG ou vídeo MP4, reconecte o WhatsApp e tente de novo."
    );
  }
  if (msg.includes("unsupported image") || msg.includes("Imagem inválida")) {
    return new Error("Imagem inválida ou formato não suportado. Envie JPEG ou PNG.");
  }
  if (/no sessions/i.test(msg) || /sessionerror/i.test(msg)) {
    return new Error(
      "WhatsApp ainda não tem sessão com algum contato da lista. Abra Conversas, envie uma mensagem para o cliente e tente publicar o status de novo."
    );
  }
  return err instanceof Error ? err : new Error(msg || "Falha ao publicar status");
}

function normalizeStatusAudienceJid(raw: string, lidToPhone: Map<string, string>): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let jid = trimmed.includes("@") ? jidNormalizedUser(trimmed) || trimmed : toSendJid(trimmed);
  if (isLidUser(jid)) {
    const mapped = lidToPhone.get(jid);
    if (!mapped) return null;
    jid = mapped;
  }
  return jid.endsWith("@s.whatsapp.net") ? jid : null;
}

export class WhatsAppClient extends EventEmitter {
  private sock: WASocket | null = null;
  private boundSock: WASocket | null = null;
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
  private allowReconnect = true;
  private reconnectTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private businessId: string,
    sessionsRoot: string
  ) {
    super();
    this.sessionPath = path.join(sessionsRoot, businessId);
    fs.mkdirSync(this.sessionPath, { recursive: true });
  }

  private tryEmitInbound(msg: WAMessage) {
    if (msg.key.fromMe) return;
    const rawJid = msg.key.remoteJid ?? "";
    if (!rawJid || shouldSkipJid(rawJid)) {
      console.log(`[wa:${this.businessId}] skip_jid ${rawJid}`);
      return;
    }

    const messageId = msg.key.id ?? "";
    if (messageId && this.seenInboundIds.has(messageId)) return;
    if (messageId) this.seenInboundIds.set(messageId, true);

    if (msg.message && messageId) {
      this.messageStore.set(messageStoreKey(msg.key), msg.message);
    }

    const mediaType = detectMediaType(msg.message);
    const body = extractBody(msg.message);
    if (!body && !mediaType) {
      const inner = msg.message ? getContentType(extractMessageContent(msg.message) ?? {}) : null;
      console.log(
        `[wa:${this.businessId}] empty_body jid=${rawJid} stub=${msg.messageStubType ?? "-"} type=${inner ?? "-"}`
      );
      return;
    }

    const { from, replyJid } = resolveAddress(msg.key, rawJid, this.lidToPhone);
    const parsed: WhatsAppMessage = {
      from,
      replyJid,
      body: body || (mediaType === "image" ? "[imagem]" : mediaType === "video" ? "[video]" : "[audio]"),
      messageId,
      timestamp: Number(msg.messageTimestamp) || Math.floor(Date.now() / 1000),
      isGroup: !!isJidGroup(rawJid),
      pushName: msg.pushName ?? undefined,
      mediaType,
    };

    console.log(
      `[wa:${this.businessId}] inbound from=${parsed.from} reply=${parsed.replyJid} text=${parsed.body.slice(0, 80)} media=${mediaType ?? "-"}`
    );
    this.emit("message", parsed, msg);
  }

  private bindSocketEvents(saveCreds: () => Promise<void>) {
    if (!this.sock || this.boundSock === this.sock) return;
    this.boundSock = this.sock;

    this.sock.ev.on("creds.update", saveCreds);

    this.sock.ev.on("chats.phoneNumberShare", ({ lid, jid }) => {
      const lidJid = toSendJid(lid);
      const phoneJid = pnToJid(jid);
      if (lidJid && phoneJid) {
        this.lidToPhone.set(lidJid, phoneJid);
        console.log(`[wa:${this.businessId}] lid_map ${lidJid} -> ${phoneJid}`);
      }
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
        console.log(`[wa:${this.businessId}] connected`);
        this.emit("connected");
      }

      if (connection === "close") {
        this.status = "close";
        this.connecting = false;
        this.boundSock = null;
        const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = code !== DisconnectReason.loggedOut && this.allowReconnect;
        console.log(`[wa:${this.businessId}] disconnected code=${code ?? "-"} reconnect=${shouldReconnect}`);
        this.emit("disconnected", { code, shouldReconnect });
        if (shouldReconnect) {
          this.cancelScheduledReconnect();
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = undefined;
            if (!this.allowReconnect) return;
            void this.connect().catch(() => undefined);
          }, 2500);
        }
      }
    });

    this.sock.ev.on("messages.upsert", ({ messages, type }) => {
      console.log(`[wa:${this.businessId}] upsert type=${type} count=${messages.length}`);
      for (const msg of messages) this.tryEmitInbound(msg);
    });

    this.sock.ev.on("messages.update", (updates) => {
      for (const { key, update } of updates) {
        if (!key?.remoteJid || key.fromMe || !update.message) continue;
        this.tryEmitInbound({ key, message: update.message, messageTimestamp: Date.now() / 1000 });
      }
    });
  }

  async kickPairing(): Promise<void> {
    if (this.isConnected() || this.lastQrDataUrl) return;

    if (this.connecting) {
      await new Promise((r) => setTimeout(r, 2500));
      if (this.isConnected() || this.lastQrDataUrl) return;
    }

    const stale =
      !this.isConnected() &&
      !this.lastQrDataUrl &&
      (this.status === "connecting" || this.connecting);

    if (this.status !== "close" && !stale) return;

    this.connecting = false;
    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch {
        /* ignore */
      }
      this.sock = null;
      this.boundSock = null;
      this.status = "close";
    }
    await this.connect();
  }

  private cancelScheduledReconnect() {
    if (this.reconnectTimer !== undefined) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  async connect() {
    if (this.isConnected()) return;
    if (this.connecting) return;
    this.allowReconnect = true;
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
        this.boundSock = null;
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
        fireInitQueries: false,
        connectTimeoutMs: 30_000,
        defaultQueryTimeoutMs: 120_000,
        shouldSyncHistoryMessage: () => false,
        msgRetryCounterCache: this.msgRetryCounterCache as any,
        getMessage: async (key) => this.messageStore.get(messageStoreKey(key)),
      });

      this.bindSocketEvents(saveCreds);
    } catch (err) {
      this.connecting = false;
      this.status = "close";
      throw err;
    }
  }

  private stashSentMessage(result: WAMessage | undefined) {
    if (result?.message && result.key?.id) {
      this.messageStore.set(messageStoreKey(result.key), result.message);
    }
  }

  private async ensurePreKeys() {
    const fn = (this.sock as { uploadPreKeysToServerIfRequired?: () => Promise<void> })
      ?.uploadPreKeysToServerIfRequired;
    if (typeof fn === "function") await fn.call(this.sock);
  }

  getOwnJid(): string | undefined {
    const id = this.sock?.user?.id;
    if (!id) return undefined;
    const normalized = jidNormalizedUser(id);
    if (normalized?.endsWith("@s.whatsapp.net")) return normalized;
    return toSendJid(id);
  }

  async sendText(to: string, text: string): Promise<string | undefined> {
    if (!this.sock) throw new Error("Socket not connected");
    const jid = toSendJid(to);
    await this.ensurePreKeys();
    const result = await this.sock.sendMessage(jid, { text });
    this.stashSentMessage(result);
    return result?.key.id ?? undefined;
  }

  async sendImage(to: string, imageUrl: string, caption?: string): Promise<string | undefined> {
    return this.sendChatMedia(to, imageUrl, "image", caption);
  }

  private messageForDownload(waMessage: WAMessage): WAMessage {
    const key = waMessage.key;
    if (!key?.id) return waMessage;
    const stored = this.messageStore.get(messageStoreKey(key));
    if (stored && waMessage.message) return waMessage;
    if (stored) return { ...waMessage, message: stored };
    return waMessage;
  }

  async downloadMessageMedia(
    waMessage: WAMessage
  ): Promise<{ buffer: Buffer; mimetype: string; mediaType: WhatsAppMediaType } | null> {
    if (!this.sock) return null;
    const payload = this.messageForDownload(waMessage);
    const mediaType = detectMediaType(payload.message);
    if (!mediaType) return null;

    const content = extractMessageContent(payload.message ?? undefined);
    const mimetype =
      content?.imageMessage?.mimetype ??
      content?.videoMessage?.mimetype ??
      content?.audioMessage?.mimetype ??
      (mediaType === "image"
        ? "image/jpeg"
        : mediaType === "video"
          ? "video/mp4"
          : "audio/ogg; codecs=opus");

    let lastErr: unknown;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 700 * attempt));
      }
      try {
        const raw = await downloadMediaMessage(
          payload,
          "buffer",
          {},
          { logger: this.logger as any, reuploadRequest: this.sock.updateMediaMessage }
        );
        if (!raw) continue;
        const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as Uint8Array);
        if (!buffer.length) continue;
        return { buffer, mimetype, mediaType };
      } catch (err) {
        lastErr = err;
      }
    }
    console.error(`[wa:${this.businessId}] downloadMessageMedia failed after retries:`, lastErr);
    return null;
  }

  private async loadRemoteMedia(
    mediaUrl: string,
    mediaType: WhatsAppMediaType
  ): Promise<{ buffer: Buffer; mimetype: string }> {
    const res = await fetch(mediaUrl, { redirect: "follow" });
    if (!res.ok) throw new Error(`Mídia inacessível (${res.status}).`);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (!buffer.length) throw new Error("Arquivo de mídia vazio.");
    const headerType = res.headers.get("content-type")?.split(";")[0]?.trim();
    if (mediaType === "video") return { buffer, mimetype: headerType || "video/mp4" };
    if (mediaType === "audio") return { buffer, mimetype: headerType || "audio/ogg" };
    if (headerType?.startsWith("image/")) return { buffer, mimetype: headerType };
    if (mediaUrl.includes(".png")) return { buffer, mimetype: "image/png" };
    if (mediaUrl.includes(".webp")) return { buffer, mimetype: "image/webp" };
    return { buffer, mimetype: "image/jpeg" };
  }

  async sendChatMedia(
    to: string,
    mediaUrl: string,
    mediaType: WhatsAppMediaType,
    caption?: string
  ): Promise<string | undefined> {
    if (!this.sock) throw new Error("Socket not connected");
    const jid = toSendJid(to);
    const { buffer, mimetype } = await this.loadRemoteMedia(mediaUrl, mediaType);
    const cap = caption?.trim() || undefined;
    const content =
      mediaType === "image"
        ? { image: buffer, mimetype, caption: cap }
        : mediaType === "video"
          ? { video: buffer, mimetype, caption: cap }
          : {
              audio: buffer,
              mimetype,
              ptt: mimetype.includes("ogg") || mimetype.includes("opus"),
            };
    await this.ensurePreKeys();
    const result = await this.sock.sendMessage(jid, content);
    this.stashSentMessage(result);
    return result?.key.id ?? undefined;
  }

  private buildStatusAudience(seedJids: string[]): string[] {
    const audience = new Set<string>();
    const ownRaw = this.sock?.user?.id;
    if (ownRaw) audience.add(jidNormalizedUser(ownRaw) || ownRaw);

    const ownPhone = this.getOwnJid();
    if (ownPhone?.endsWith("@s.whatsapp.net")) audience.add(ownPhone);

    for (const raw of seedJids) {
      const jid = normalizeStatusAudienceJid(raw, this.lidToPhone);
      if (jid) audience.add(jid);
    }

    return [...audience].slice(0, 500);
  }

  private async warmStatusSessions(jids: string[]): Promise<void> {
    const assertSessions = (
      this.sock as { assertSessions?: (jids: string[], force: boolean) => Promise<boolean> }
    ).assertSessions;
    if (typeof assertSessions !== "function") return;

    const phoneJids = [...new Set(jids.filter((j) => j.endsWith("@s.whatsapp.net")))];
    if (!phoneJids.length) return;

    for (const jid of phoneJids) {
      try {
        await assertSessions([jid], false);
      } catch (err) {
        console.warn(`[wa:${this.businessId}] status session warmup skip ${jid}:`, err);
      }
    }
    await new Promise((r) => setTimeout(r, 600));
    try {
      await assertSessions(phoneJids, false);
    } catch (err) {
      console.warn(`[wa:${this.businessId}] status session warmup batch:`, err);
    }
  }

  private waitForStatusPublishAck(key: MsgKey, timeoutMs = 90_000): Promise<void> {
    const sock = this.sock;
    if (!sock) throw new Error("Socket not connected");

    const minAck = proto.WebMessageInfo.Status.SERVER_ACK;
    const errorStatus = proto.WebMessageInfo.Status.ERROR;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("WhatsApp não confirmou a publicação do status a tempo."));
      }, timeoutMs);

      const onUpdate = (updates: { key: MsgKey; update: Partial<WAMessage> }[]) => {
        for (const { key: k, update } of updates) {
          if (k.id !== key.id) continue;
          if (k.fromMe !== key.fromMe) continue;
          const remote = k.remoteJid ?? "";
          if (remote !== key.remoteJid && remote !== "status@broadcast") continue;

          const st = update.status;
          if (st === errorStatus) {
            cleanup();
            reject(new Error("WhatsApp rejeitou a publicação do status."));
            return;
          }
          if (st != null && st !== proto.WebMessageInfo.Status.PENDING && st >= minAck) {
            cleanup();
            resolve();
            return;
          }
        }
      };

      const cleanup = () => {
        clearTimeout(timer);
        sock.ev.off("messages.update", onUpdate);
      };

      sock.ev.on("messages.update", onUpdate);
    });
  }

  async publishStatus(opts: {
    mediaUrl: string;
    mediaType: "image" | "video";
    caption?: string;
    statusJidList: string[];
  }): Promise<string | undefined> {
    if (!this.sock) throw new Error("Socket not connected");

    const statusJidList = this.buildStatusAudience(opts.statusJidList);
    const recipientCount = statusJidList.filter((j) => j.endsWith("@s.whatsapp.net")).length;
    if (recipientCount < 1) {
      throw new Error(
        "Para publicar status, é preciso de conversas com telefone válido no ZapFlow. Peça ao cliente enviar uma mensagem; depois tente de novo."
      );
    }

    await this.warmStatusSessions(statusJidList);

    const { buffer, mimetype } = await this.loadRemoteMedia(opts.mediaUrl, opts.mediaType);

    let content: Record<string, unknown>;
    if (opts.mediaType === "video") {
      const mt = mimetype.includes("mp4") ? mimetype : "video/mp4";
      content = { video: buffer, mimetype: mt, caption: opts.caption };
    } else {
      try {
        const img = await prepareStatusImage(buffer);
        content = {
          image: img.buffer,
          mimetype: img.mimetype,
          caption: opts.caption,
          jpegThumbnail: img.jpegThumbnail,
          width: img.width,
          height: img.height,
        };
      } catch {
        throw new Error("Imagem inválida ou formato não suportado. Envie JPEG ou PNG.");
      }
    }

    await this.ensurePreKeys();
    let result: WAMessage | undefined;
    try {
      result = await this.sock.sendMessage("status@broadcast", content as never, {
        broadcast: true,
        statusJidList,
        mediaUploadTimeoutMs: 180_000,
      });
    } catch (err) {
      throw formatPublishStatusError(err);
    }
    this.stashSentMessage(result);

    if (result?.key?.id) {
      try {
        await this.waitForStatusPublishAck(result.key);
      } catch (err) {
        throw formatPublishStatusError(err);
      }
    }

    return result?.key?.id ?? undefined;
  }

  async logout() {
    this.allowReconnect = false;
    this.cancelScheduledReconnect();
    this.connecting = false;
    this.lastQrDataUrl = undefined;
    try {
      await this.sock?.logout();
    } catch {
      /* ignore */
    }
    this.sock = null;
    this.boundSock = null;
    this.status = "close";
    this.messageStore.clear();
    this.lidToPhone.clear();
    if (fs.existsSync(this.sessionPath)) {
      fs.rmSync(this.sessionPath, { recursive: true, force: true });
    }
  }

  isConnected(): boolean {
    if (this.status !== "open" || !this.sock) return false;
    return socketIsOpen(this.sock);
  }

  isReadyToSend(): boolean {
    return this.status === "open" && !!this.sock;
  }

  getDebugInfo() {
    return {
      businessId: this.businessId,
      status: this.status,
      socketOpen: socketIsOpen(this.sock),
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

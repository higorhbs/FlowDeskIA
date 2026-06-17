import { sendNativeButtons } from "./native-buttons.js";
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
  type WAMessage,
  type WASocket,
} from "@whiskeysockets/baileys";

export type { WAMessage };
export type { WaAuthFileStore } from "./remote-auth-state.js";
import NodeCache from "@cacheable/node-cache";
import { Boom } from "@hapi/boom";
import sharp from "sharp";
import { gifToMp4Buffer } from "./gif-media.js";
import { createWaLogger } from "./wa-logger.js";
import { waLog } from "./wa-app-log.js";
import { toDataURL } from "qrcode";
import EventEmitter from "events";
import { useRemoteAuthState, type WaAuthFileStore } from "./remote-auth-state.js";

export type WhatsAppMediaType = "image" | "video" | "audio" | "gif";

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

const MESSAGE_STORE_MAX = 400;

function phoneDigitsMatch(a: string, b: string): boolean {
  const da = a.replace(/\D/g, "");
  const db = b.replace(/\D/g, "");
  if (!da || !db) return false;
  if (da === db) return true;
  if (da.length >= 10 && db.length >= 10) {
    return da.slice(-11) === db.slice(-11) || da.slice(-10) === db.slice(-10);
  }
  return da.endsWith(db) || db.endsWith(da);
}

function pnToJid(pn: string): string {
  const raw = pn.trim();
  if (raw.includes("@")) return jidNormalizedUser(raw) || raw;
  const digits = raw.replace(/\D/g, "");
  return digits ? `${digits}@s.whatsapp.net` : raw;
}

function brazilPhoneDigitVariants(digits: string): string[] {
  const d = digits.replace(/\D/g, "");
  if (!d) return [];
  const out = new Set<string>([d]);
  if (d.startsWith("55") && d.length === 13 && d[4] === "9") {
    out.add(`${d.slice(0, 4)}${d.slice(5)}`);
  }
  if (d.startsWith("55") && d.length === 12) {
    out.add(`${d.slice(0, 4)}9${d.slice(4)}`);
  }
  return [...out];
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
  const normalized = toSendJid(remoteJid);
  const extended = key as MsgKey & {
    senderPn?: string;
    participantPn?: string;
    remoteJidAlt?: string;
    participantAlt?: string;
  };
  const pn = extended.senderPn || extended.participantPn;
  const phoneJid = pn ? pnToJid(pn) : null;
  const altRaw = extended.remoteJidAlt || extended.participantAlt;
  const altJid = altRaw ? toSendJid(altRaw) : null;

  if (isLidUser(normalized)) {
    const phone =
      phoneJid ??
      (altJid && !isLidUser(altJid) ? altJid : null) ??
      lidToPhone.get(normalized) ??
      null;
    if (phone) lidToPhone.set(normalized, phone);
    const reply = phone ?? normalized;
    return { from: reply, replyJid: reply };
  }

  if (altJid && isLidUser(altJid) && normalized.endsWith("@s.whatsapp.net")) {
    lidToPhone.set(altJid, normalized);
  }

  if (phoneJid) return { from: phoneJid, replyJid: phoneJid };
  return { from: normalized, replyJid: normalized };
}

function extractBody(message: proto.IMessage | null | undefined): string {
  const content = extractMessageContent(message ?? undefined);
  if (!content) return "";

  const type = getContentType(content);
  if (type === "conversation") return content.conversation?.trim() ?? "";
  if (type === "extendedTextMessage") return content.extendedTextMessage?.text?.trim() ?? "";

  const nativeFlowParams =
    content.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
  if (nativeFlowParams) {
    try {
      const parsed = JSON.parse(nativeFlowParams) as { id?: string; display_text?: string };
      if (parsed.id?.trim()) return parsed.id.trim();
      if (parsed.display_text?.trim()) return parsed.display_text.trim();
    } catch {
      /* ignore */
    }
  }

  const buttonsReply = content.buttonsResponseMessage;
  if (buttonsReply?.selectedButtonId?.trim()) return buttonsReply.selectedButtonId.trim();
  if (typeof buttonsReply?.selectedDisplayText === "string" && buttonsReply.selectedDisplayText.trim()) {
    return buttonsReply.selectedDisplayText.trim();
  }

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
  const ws = (sock as { ws?: { isOpen?: boolean; readyState?: number } }).ws;
  if (!ws) return true;
  if (ws.isOpen === true) return true;
  if (typeof ws.readyState === "number") return ws.readyState === 1;
  return true;
}

function isSignalSessionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : "";
  return name === "SessionError" || /no matching sessions|no sessions|bad mac/i.test(msg);
}

function isBaileysTimeout(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const code = (err as { output?: { statusCode?: number } })?.output?.statusCode;
  return msg === "Timed Out" || code === 408 || /time-out|timed out/i.test(msg);
}

function isPublishRetriable(err: unknown): boolean {
  return isSignalSessionError(err) || isBaileysTimeout(err);
}

function linkedDeviceBrowser(): [string, string, string] {
  const name = process.env.WA_LINKED_DEVICE_NAME?.trim() || "FlowDesk";
  return [name, "Chrome", "120.0.0"];
}

export class WhatsAppClient extends EventEmitter {
  private sock: WASocket | null = null;
  private boundSock: WASocket | null = null;
  private clearAuthStore?: () => Promise<void>;
  private logger = createWaLogger();
  private messageStore = new Map<string, proto.IMessage>();
  private msgRetryCounterCache = new NodeCache({ stdTTL: 600, useClones: false });
  private seenInboundIds = new NodeCache({ stdTTL: 86_400, useClones: false });
  private liveInboundSinceSec = 0;
  private lidToPhone = new Map<string, string>();
  private replyJidByContact = new Map<string, string>();
  public status: ConnectionStatus = "close";
  public lastQrDataUrl?: string;
  private connecting = false;
  private allowReconnect = true;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private connectedAt = 0;
  private statusChannelReady = false;
  private audiencePreparedAt = 0;
  private publishQueue: Promise<void> = Promise.resolve();

  constructor(
    private businessId: string,
    private authStore: WaAuthFileStore
  ) {
    super();
  }

  private stopSocket() {
    const sock = this.sock;
    if (!sock) return;
    try {
      sock.ev.removeAllListeners("creds.update");
      sock.end(undefined);
    } catch {
      /* ignore */
    }
  }

  async shutdown(): Promise<void> {
    this.allowReconnect = false;
    this.cancelScheduledReconnect();
    this.connecting = false;
    this.stopSocket();
    this.sock = null;
    this.boundSock = null;
    this.status = "close";
  }

  private stashInMessageStore(key: string, message: proto.IMessage) {
    if (this.messageStore.size >= MESSAGE_STORE_MAX) {
      const first = this.messageStore.keys().next().value;
      if (first) this.messageStore.delete(first);
    }
    this.messageStore.set(key, message);
  }

  private isLiveInbound(msg: WAMessage): boolean {
    const ts = Number(msg.messageTimestamp) || 0;
    if (!ts) return false;
    const liveSince = this.liveInboundSinceSec;
    if (liveSince > 0 && ts < liveSince - 30) return false;
    return true;
  }

  private tryEmitInbound(msg: WAMessage) {
    if (msg.key.fromMe) return;
    const rawJid = msg.key.remoteJid ?? "";
    if (!rawJid || shouldSkipJid(rawJid)) return;
    if (!this.isLiveInbound(msg)) return;

    const messageId = msg.key.id ?? "";
    if (messageId && this.seenInboundIds.has(messageId)) return;
    if (messageId) this.seenInboundIds.set(messageId, true);

    if (msg.message && messageId) {
      this.stashInMessageStore(messageStoreKey(msg.key), msg.message);
    }

    const mediaType = detectMediaType(msg.message);
    const body = extractBody(msg.message);
    if (!body && !mediaType) {
      const inner = msg.message ? getContentType(extractMessageContent(msg.message) ?? {}) : null;
      waLog.debug(
        `[wa:${this.businessId}] empty_body jid=${rawJid} stub=${msg.messageStubType ?? "-"} type=${inner ?? "-"}`
      );
      return;
    }

    const { from, replyJid } = resolveAddress(msg.key, rawJid, this.lidToPhone);
    this.rememberReplyJid(from, replyJid);
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
        this.connectedAt = Date.now();
        this.liveInboundSinceSec = Math.floor(this.connectedAt / 1000);
        this.lastQrDataUrl = undefined;
        this.connecting = false;
        waLog.info(`[wa:${this.businessId}] connected`);
        this.emit("connected");
      }

      if (connection === "close") {
        this.status = "close";
        this.connecting = false;
        this.boundSock = null;
        this.statusChannelReady = false;
        this.audiencePreparedAt = 0;
        const code = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const replaced =
          code === DisconnectReason.connectionReplaced || code === 440;
        if (replaced) {
          this.allowReconnect = false;
          waLog.warn(
            `[wa:${this.businessId}] connection replaced — stop reconnect (another instance or phone took session)`
          );
        }
        const shouldReconnect =
          code !== DisconnectReason.loggedOut && !replaced && this.allowReconnect;
        waLog.info(`[wa:${this.businessId}] disconnected code=${code ?? "-"} reconnect=${shouldReconnect}`);
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
      if (type && type !== "notify") return;
      for (const msg of messages) {
        const remoteJid = msg.key.remoteJid ?? "";
        if (msg.key.fromMe && msg.message && msg.key.id) {
          if (!shouldSkipJid(remoteJid)) {
            this.stashInMessageStore(messageStoreKey(msg.key), msg.message);
          }
          continue;
        }
        if (!remoteJid || shouldSkipJid(remoteJid)) continue;
        this.tryEmitInbound(msg);
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
        this.stopSocket();
        this.sock = null;
        this.boundSock = null;
        this.status = "close";
      }

      const { state, saveCreds: persistCreds, clearAuth } = await useRemoteAuthState(
        this.authStore
      );
      this.clearAuthStore = clearAuth;
      const saveCreds = async () => {
        try {
          await persistCreds();
        } catch (err) {
          waLog.error(`[wa:${this.businessId}] saveCreds failed:`, err);
        }
      };
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
        browser: linkedDeviceBrowser(),
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys as never, this.logger as any),
        },
        printQRInTerminal: false,
        generateHighQualityLinkPreview: false,
        markOnlineOnConnect: false,
        fireInitQueries: false,
        connectTimeoutMs: 60_000,
        defaultQueryTimeoutMs: 180_000,
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

  private rememberReplyJid(from: string, replyJid: string) {
    const reply = replyJid.trim();
    if (!reply) return;
    this.replyJidByContact.set(from, reply);
    this.replyJidByContact.set(reply, reply);
    if (from !== reply) this.replyJidByContact.set(toSendJid(from), reply);
    if (isLidUser(reply)) {
      const phone = toSendJid(from);
      if (phone.endsWith("@s.whatsapp.net")) this.lidToPhone.set(reply, phone);
    }
  }

  private resolveSendJid(to: string): string {
    const raw = to.trim();
    if (!raw) throw new Error("Destino vazio");
    if (raw.includes("@")) return toSendJid(raw);
    const cached = this.replyJidByContact.get(raw) ?? this.replyJidByContact.get(toSendJid(raw));
    if (cached) return cached;
    return toSendJid(raw);
  }

  private stashSentMessage(result: WAMessage | undefined) {
    if (result?.message && result.key?.id) {
      this.stashInMessageStore(messageStoreKey(result.key), result.message);
    }
  }

  private normalizeAudienceJid(j: string): string | undefined {
    const jid = j.includes("@") ? jidNormalizedUser(j) || j : toSendJid(j);
    if (isLidUser(jid)) {
      const phone = this.lidToPhone.get(jid);
      if (phone?.endsWith("@s.whatsapp.net")) return phone;
      return undefined;
    }
    if (jid.endsWith("@s.whatsapp.net")) return jid;
    return undefined;
  }

  private buildAudienceList(jids: string[]): string[] {
    const audience = new Set<string>();
    const own = this.getOwnJid();
    if (own) audience.add(own);
    for (const j of jids) {
      const jid = this.normalizeAudienceJid(j);
      if (jid) audience.add(jid);
    }
    return [...audience];
  }

  private runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.publishQueue.then(fn, fn);
    this.publishQueue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  private async ensureStatusChannelReady(ownJid: string): Promise<void> {
    if (this.statusChannelReady || !this.sock) return;
    await this.ensurePreKeys();
    const assertFn = this.sockSendApi()?.assertSessions;
    if (typeof assertFn === "function") {
      await assertFn.call(this.sock, [ownJid], false);
    }
    try {
      await this.sock.sendMessage(
        "status@broadcast",
        { text: "\u200c" },
        { broadcast: true, statusJidList: [ownJid] }
      );
      this.statusChannelReady = true;
      waLog.debug(`[wa:${this.businessId}] status channel bootstrapped`);
      await new Promise((r) => setTimeout(r, 4000));
    } catch (err) {
      waLog.warn(`[wa:${this.businessId}] status channel bootstrap:`, err);
      if (!isSignalSessionError(err)) throw err;
    }
  }

  private sockSendApi() {
    return this.sock as {
      assertSessions?: (jids: string[], force: boolean) => Promise<boolean>;
    } | null;
  }

  private async assertAudienceSessions(jids: string[], force = false): Promise<void> {
    const fn = this.sockSendApi()?.assertSessions;
    if (typeof fn !== "function" || !jids.length) return;
    const batchSize = 20;
    for (let i = 0; i < jids.length; i += batchSize) {
      const batch = jids.slice(i, i + batchSize);
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await fn.call(this.sock, batch, force);
          break;
        } catch (err) {
          if (!isSignalSessionError(err) || attempt >= 2) throw err;
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        }
      }
      if (i + batchSize < jids.length) await new Promise((r) => setTimeout(r, 500));
    }
  }

  async prepareStatusAudience(jids: string[], opts?: { force?: boolean }): Promise<void> {
    if (!this.sock) throw new Error("Socket not connected");
    const now = Date.now();
    if (!opts?.force && this.audiencePreparedAt > 0 && now - this.audiencePreparedAt < 300_000) {
      return;
    }
    const userList = this.buildAudienceList(jids);
    if (!userList.length) return;
    await this.ensurePreKeys();
    await this.assertAudienceSessions(userList, false);
    this.audiencePreparedAt = now;
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
    const jid = this.resolveSendJid(to);
    await this.ensurePreKeys();
    const result = await this.sock.sendMessage(jid, { text });
    this.stashSentMessage(result);
    return result?.key.id ?? undefined;
  }

  private collectButtonSendTargets(to: string): string[] {
    const seen = new Set<string>();
    const lids: string[] = [];
    const phones: string[] = [];

    const add = (jid?: string) => {
      if (!jid) return;
      const normalized = toSendJid(jid);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      if (isLidUser(normalized)) lids.push(normalized);
      else if (normalized.endsWith("@s.whatsapp.net")) phones.push(normalized);
    };

    const raw = to.trim();
    add(raw.includes("@") ? raw : undefined);
    add(this.resolveSendJid(raw));

    for (const jid of [...lids, ...phones]) {
      if (isLidUser(jid)) {
        add(this.lidToPhone.get(jid));
      } else {
        const cached =
          this.replyJidByContact.get(raw) ??
          this.replyJidByContact.get(jid) ??
          this.replyJidByContact.get(toSendJid(raw));
        if (cached) add(cached);
        for (const [lid, phone] of this.lidToPhone) {
          if (phone === jid) add(lid);
        }
      }
    }

    return [...phones, ...lids];
  }

  private collectSendTargets(to: string): string[] {
    const seen = new Set<string>();
    const targets: string[] = [];
    const add = (jid?: string) => {
      if (!jid || seen.has(jid)) return;
      seen.add(jid);
      targets.push(jid);
    };

    for (const jid of this.collectButtonSendTargets(to)) add(jid);

    const raw = to.trim();
    const digits = raw.replace(/\D/g, "");
    const own = this.getOwnJid();
    if (own) {
      const ownDigits = own.split("@")[0] ?? "";
      if (digits && phoneDigitsMatch(digits, ownDigits)) add(own);
    }
    for (const variant of brazilPhoneDigitVariants(digits)) {
      add(pnToJid(variant));
      for (const jid of this.collectButtonSendTargets(variant)) add(jid);
      for (const jid of this.collectButtonSendTargets(pnToJid(variant))) add(jid);
    }

    if (!targets.length) add(this.resolveSendJid(to));
    return targets;
  }

  async sendButtons(
    to: string,
    text: string,
    buttons: { id: string; label: string }[],
  ): Promise<string | undefined> {
    if (!this.sock) throw new Error("Socket not connected");
    const items = buttons.slice(0, 3);
    if (!items.length) return this.sendText(to, text);

    const targets = this.collectButtonSendTargets(to);
    if (!targets.length) return this.sendText(to, text);

    let lastErr: unknown;
    for (const jid of targets) {
      try {
        await this.ensurePreKeys();
        const footer = text.trim() ? undefined : "Toque em uma opção";
        const result = await sendNativeButtons(this.sock, jid, text, items, footer);
        this.stashSentMessage(result as WAMessage);
        return result?.key?.id ?? undefined;
      } catch (err) {
        lastErr = err;
        waLog.warn(`[wa:${this.businessId}] sendButtons failed jid=${jid}:`, err);
      }
    }

    waLog.error(`[wa:${this.businessId}] sendButtons exhausted targets:`, lastErr);
    throw lastErr instanceof Error ? lastErr : new Error("Falha ao enviar botoes");
  }

  async sendImage(to: string, imageUrl: string, caption?: string): Promise<string | undefined> {
    return this.sendChatMedia(to, imageUrl, "image", caption);
  }

  async sendImageBuffer(
    to: string,
    buffer: Buffer,
    mimetype: string,
    caption?: string,
  ): Promise<string | undefined> {
    return this.sendChatMediaBuffer(to, buffer, mimetype, "image", caption);
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
    waLog.error(`[wa:${this.businessId}] downloadMessageMedia failed after retries:`, lastErr);
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
    if (mediaType === "gif") return { buffer, mimetype: headerType || "image/gif" };
    if (mediaType === "audio") return { buffer, mimetype: headerType || "audio/ogg" };
    if (headerType?.startsWith("image/")) return { buffer, mimetype: headerType };
    if (mediaUrl.includes(".gif")) return { buffer, mimetype: "image/gif" };
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
    if (mediaType === "gif") {
      let buffer: Buffer | undefined;
      try {
        ({ buffer } = await this.loadRemoteMedia(mediaUrl, "gif"));
      } catch {
        buffer = undefined;
      }
      return this.sendFlowGif(to, { buffer, mediaUrl, caption });
    }
    const { buffer, mimetype } = await this.loadRemoteMedia(mediaUrl, mediaType);
    return this.sendChatMediaBuffer(to, buffer, mimetype, mediaType, caption);
  }

  async sendDocument(
    to: string,
    buffer: Buffer,
    filename: string,
    mimetype = "application/pdf",
    caption?: string,
  ): Promise<string | undefined> {
    if (!this.sock) throw new Error("Socket not connected");
    const cap = caption?.trim() || undefined;
    const targets = this.collectSendTargets(to);
    let lastErr: unknown;
    for (const jid of targets) {
      try {
        await this.ensurePreKeys();
        const result = await this.sock.sendMessage(jid, {
          document: buffer,
          mimetype,
          fileName: filename,
          caption: cap,
        });
        if (!result?.key?.id) throw new Error("WhatsApp não confirmou envio do documento.");
        this.stashSentMessage(result);
        return result.key.id;
      } catch (err) {
        lastErr = err;
        waLog.warn(`[wa:${this.businessId}] sendDocument failed jid=${jid}:`, err);
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("Falha ao enviar documento.");
  }

  async sendChatMediaBuffer(
    to: string,
    buffer: Buffer,
    mimetype: string,
    mediaType: WhatsAppMediaType,
    caption?: string,
  ): Promise<string | undefined> {
    if (!this.sock) throw new Error("Socket not connected");
    const jid = this.resolveSendJid(to);
    const cap = caption?.trim() || undefined;
    await this.ensurePreKeys();

    if (mediaType === "gif" || mimetype === "image/gif") {
      return this.sendFlowGif(to, { buffer, mediaUrl: "", caption: cap });
    }

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
    const result = await this.sock.sendMessage(jid, content);
    if (!result?.key?.id) throw new Error("WhatsApp não confirmou envio da mídia.");
    this.stashSentMessage(result);
    return result.key.id;
  }

  async sendFlowGif(
    to: string,
    opts: { buffer?: Buffer; mediaUrl: string; altUrl?: string; caption?: string },
  ): Promise<string | undefined> {
    if (!this.sock) throw new Error("Socket not connected");
    const jid = this.resolveSendJid(to);
    const cap = opts.caption?.trim() || undefined;
    await this.ensurePreKeys();

    const stash = (result: WAMessage | undefined) => {
      if (!result?.key?.id) return undefined;
      this.stashSentMessage(result);
      return result.key.id;
    };

    const urls = [...new Set(
      [opts.mediaUrl, opts.altUrl]
        .map((u) => u?.trim())
        .filter((u): u is string => Boolean(u)),
    )];
    let lastErr: unknown;
    let buffer = opts.buffer?.length ? opts.buffer : undefined;

    if (!buffer) {
      for (const url of urls) {
        try {
          ({ buffer } = await this.loadRemoteMedia(url, "gif"));
          if (buffer?.length) break;
        } catch (err) {
          lastErr = err;
        }
      }
    }

    const attempts: Array<() => Promise<string | undefined>> = [];

    if (buffer?.length) {
      const mp4 = await gifToMp4Buffer(buffer);
      if (mp4?.length) {
        attempts.push(async () =>
          stash(
            await this.sock!.sendMessage(jid, {
              video: mp4,
              gifPlayback: true,
              caption: cap,
            }),
          ),
        );
        attempts.push(async () =>
          stash(
            await this.sock!.sendMessage(jid, {
              video: mp4,
              mimetype: "video/mp4",
              gifPlayback: true,
              caption: cap,
            }),
          ),
        );
      }
      attempts.push(async () =>
        stash(
          await this.sock!.sendMessage(jid, {
            image: buffer,
            mimetype: "image/gif",
            caption: cap,
          }),
        ),
      );
    }

    for (const url of urls) {
      attempts.push(async () =>
        stash(
          await this.sock!.sendMessage(jid, {
            video: { url },
            gifPlayback: true,
            caption: cap,
          }),
        ),
      );
      attempts.push(async () =>
        stash(
          await this.sock!.sendMessage(jid, {
            image: { url },
            caption: cap,
          }),
        ),
      );
    }

    for (const attempt of attempts) {
      try {
        const id = await attempt();
        return id ?? "delivered";
      } catch (err) {
        lastErr = err;
      }
    }

    waLog.warn(`[wa:${this.businessId}] sendFlowGif failed urls=${urls.length} buffer=${!!buffer}:`, lastErr);
    throw lastErr instanceof Error ? lastErr : new Error("Falha ao enviar GIF.");
  }

  private async loadStatusMedia(
    mediaUrl: string,
    mediaType: "image" | "video"
  ): Promise<{ buffer: Buffer; mimetype: string }> {
    const res = await fetch(mediaUrl, { redirect: "follow" });
    if (!res.ok) {
      throw new Error(`Mídia inacessível para o WhatsApp (${res.status}). Confira a URL pública.`);
    }
    let buffer = Buffer.from(await res.arrayBuffer());
    if (!buffer.length) throw new Error("Arquivo de mídia vazio.");
    const headerType = res.headers.get("content-type")?.split(";")[0]?.trim();
    if (mediaType === "video") {
      return { buffer, mimetype: headerType || "video/mp4" };
    }
    let mimetype = headerType?.startsWith("image/") ? headerType : "image/jpeg";
    if (!headerType?.startsWith("image/")) {
      if (mediaUrl.includes(".png")) mimetype = "image/png";
      else if (mediaUrl.includes(".webp")) mimetype = "image/webp";
    }
    if (mimetype === "image/webp") {
      buffer = Buffer.from(await sharp(buffer).jpeg({ quality: 90 }).toBuffer());
      mimetype = "image/jpeg";
    }
    const meta = await sharp(buffer).metadata();
    if ((meta.width ?? 0) > 1080 || mimetype === "image/png") {
      buffer = Buffer.from(
        await sharp(buffer)
          .resize({ width: 1080, withoutEnlargement: true })
          .jpeg({ quality: 88 })
          .toBuffer()
      );
      mimetype = "image/jpeg";
    }
    return { buffer, mimetype };
  }

  private async normalizeStatusBuffer(
    buffer: Buffer,
    mimetype: string | undefined,
    mediaType: "image" | "video",
    mediaUrl?: string
  ): Promise<{ buffer: Buffer; mimetype: string }> {
    if (mediaType === "video") {
      return { buffer, mimetype: mimetype?.includes("mp4") ? mimetype : "video/mp4" };
    }
    let out = buffer;
    let mt = mimetype?.startsWith("image/") ? mimetype : "image/jpeg";
    if (!mimetype?.startsWith("image/")) {
      if (mediaUrl?.includes(".png")) mt = "image/png";
      else if (mediaUrl?.includes(".webp")) mt = "image/webp";
    }
    if (mt === "image/webp") {
      out = Buffer.from(await sharp(out).jpeg({ quality: 90 }).toBuffer());
      mt = "image/jpeg";
    }
    const meta = await sharp(out).metadata();
    if ((meta.width ?? 0) > 1080 || mt === "image/png") {
      out = Buffer.from(
        await sharp(out)
          .resize({ width: 1080, withoutEnlargement: true })
          .jpeg({ quality: 88 })
          .toBuffer()
      );
      mt = "image/jpeg";
    }
    return { buffer: out, mimetype: mt };
  }

  async publishStatus(opts: {
    mediaUrl?: string;
    mediaBuffer?: Buffer;
    mediaMimetype?: string;
    mediaType: "image" | "video";
    caption?: string;
    statusJidList: string[];
  }): Promise<string | undefined> {
    return this.runExclusive(() => this.publishStatusInner(opts));
  }

  private async publishStatusInner(opts: {
    mediaUrl?: string;
    mediaBuffer?: Buffer;
    mediaMimetype?: string;
    mediaType: "image" | "video";
    caption?: string;
    statusJidList: string[];
  }): Promise<string | undefined> {
    if (!this.sock) throw new Error("Socket not connected");

    const deadline = Date.now() + 60_000;
    while (!this.isPublishReady() && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!this.isPublishReady()) {
      throw new Error("Sessão WhatsApp ainda sincronizando.");
    }

    const own = this.getOwnJid();
    if (!own) throw new Error("WhatsApp sem identidade. Reconecte.");

    const statusJidList = this.buildAudienceList(opts.statusJidList).slice(0, 500);
    if (!statusJidList.length) {
      throw new Error("Nenhum contato na audiência do status.");
    }

    waLog.debug(
      `[wa:${this.businessId}] publishStatus start audience=${statusJidList.length} media=${opts.mediaType}`
    );

    const { buffer, mimetype } = opts.mediaBuffer
      ? await this.normalizeStatusBuffer(
          opts.mediaBuffer,
          opts.mediaMimetype,
          opts.mediaType,
          opts.mediaUrl
        )
      : await this.loadStatusMedia(opts.mediaUrl!, opts.mediaType);

    const content =
      opts.mediaType === "video"
        ? { video: buffer, mimetype, caption: opts.caption }
        : { image: buffer, mimetype, caption: opts.caption };

    await this.ensurePreKeys();

    let lastErr: unknown;
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 6000 * attempt));
        if (!this.isConnected()) throw new Error("Socket not connected");
        await this.ensurePreKeys();
      }
      try {
        const result = await this.sock!.sendMessage("status@broadcast", content, {
          broadcast: true,
          statusJidList,
          mediaUploadTimeoutMs: 240_000,
        });
        this.stashSentMessage(result);
        waLog.info(
          `[wa:${this.businessId}] publishStatus ok audience=${statusJidList.length} attempt=${attempt + 1}`
        );
        return result?.key?.id ?? undefined;
      } catch (err) {
        lastErr = err;
        if (!isPublishRetriable(err) || attempt >= 4) throw err;
        waLog.warn(`[wa:${this.businessId}] publishStatus retry ${attempt + 1}:`, err);
      }
    }
    throw lastErr;
  }

  async deleteStatus(messageId: string): Promise<void> {
    return this.runExclusive(async () => {
      if (!this.sock) throw new Error("Socket not connected");
      const own = this.getOwnJid();
      if (!own) throw new Error("WhatsApp sem identidade");
      await this.ensurePreKeys();
      await this.sock.sendMessage("status@broadcast", {
        delete: {
          remoteJid: "status@broadcast",
          fromMe: true,
          id: messageId,
          participant: own,
        },
      });
      waLog.debug(`[wa:${this.businessId}] deleteStatus ok id=${messageId}`);
    });
  }

  private waitForOpen(timeoutMs: number): Promise<boolean> {
    if (this.isConnected()) return Promise.resolve(true);
    return new Promise((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearInterval(poll);
        this.off("connected", onConnected);
        resolve(ok);
      };
      const onConnected = () => finish(true);
      const timer = setTimeout(() => finish(this.isConnected()), timeoutMs);
      const poll = setInterval(() => {
        if (this.isConnected()) finish(true);
      }, 300);
      this.once("connected", onConnected);
    });
  }

  async logout() {
    this.allowReconnect = false;
    this.cancelScheduledReconnect();
    this.connecting = false;
    this.lastQrDataUrl = undefined;

    if (!this.isConnected()) {
      if (this.sock) {
        try {
          this.sock.ev.removeAllListeners("creds.update");
          this.sock.end(undefined);
        } catch {
          /* ignore */
        }
        this.sock = null;
        this.boundSock = null;
        this.status = "close";
      }
      try {
        await this.connect();
        this.allowReconnect = false;
        this.cancelScheduledReconnect();
        await this.waitForOpen(20_000);
      } catch {
        /* best effort remote logout */
      }
    }

    const sock = this.sock;
    this.sock = null;
    this.boundSock = null;
    this.status = "close";
    if (sock) {
      sock.ev.removeAllListeners("creds.update");
      try {
        await sock.logout();
      } catch {
        /* ignore */
      }
      try {
        sock.end(undefined);
      } catch {
        /* ignore */
      }
    }
    this.messageStore.clear();
    this.lidToPhone.clear();
    this.replyJidByContact.clear();
    this.statusChannelReady = false;
    this.audiencePreparedAt = 0;
    if (this.clearAuthStore) {
      try {
        await this.clearAuthStore();
      } catch {
        /* ignore */
      }
      this.clearAuthStore = undefined;
    } else {
      try {
        await this.authStore.clear();
      } catch {
        /* ignore */
      }
    }
  }

  isConnected(): boolean {
    if (this.status !== "open" || !this.sock) return false;
    return socketIsOpen(this.sock);
  }

  isReadyToSend(): boolean {
    return this.status === "open" && !!this.sock;
  }

  isPublishReady(): boolean {
    if (!this.isConnected() || !this.getOwnJid()) return false;
    if (this.connectedAt > 0 && Date.now() - this.connectedAt < 8_000) return false;
    return true;
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

  getOrCreate(businessId: string, authStore: WaAuthFileStore): WhatsAppClient {
    if (!this.clients.has(businessId)) {
      const client = new WhatsAppClient(businessId, authStore);
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

  async shutdownAll(): Promise<void> {
    await Promise.all([...this.clients.values()].map((c) => c.shutdown()));
    this.clients.clear();
  }

  all(): Map<string, WhatsAppClient> {
    return this.clients;
  }
}

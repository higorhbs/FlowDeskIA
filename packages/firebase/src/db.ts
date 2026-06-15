import type {
  Tenant,
  Business,
  BusinessWithRelations,
  CatalogItem,
  FAQ,
  Conversation,
  Message,
  Appointment,
  Payment,
  ConversationStatus,
  AppointmentStatus,
  PaymentStatus,
  Plan,
  PlanStatus,
  BusinessAsaasIntegration,
  BusinessCreateInput,
  ScheduledStatus,
  ScheduledStatusState,
  ScheduledStatusMediaType,
} from "./types.js";
import {
  assertStoriesPublishQuota,
  assertLeadFlowMediaQuota,
  normalizeLeadCaptureFlow,
  STARTER_TRIAL_DAYS,
  monthKey,
  type PlanTier,
} from "@flowdesk/shared";
import type { LeadCaptureFlow } from "@flowdesk/shared";
import { buildBusinessCreateRecord, normalizeBusiness, serializeLeadFlowForFirestore } from "./business-record.js";
import { getBusinessSchedule, resolveBotOperatingContext } from "./schedule.js";
import { resolveStoryScheduledAts } from "./schedule-status-dates.js";
import type { Query, QueryDocumentSnapshot } from "firebase-admin/firestore";
import { FieldValue as AdminFieldValue } from "firebase-admin/firestore";
import { getDb, newId, nowIso } from "./admin.js";

const tenants = () => getDb().collection("tenants");
const businesses = () => getDb().collection("businesses");

function removeUndefined<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as T;
}

function businessRef(id: string) {
  return businesses().doc(id);
}

function catalogCol(businessId: string) {
  return businessRef(businessId).collection("catalog");
}

function faqsCol(businessId: string) {
  return businessRef(businessId).collection("faqs");
}

function sortBySortOrder<T extends { sortOrder?: number }>(items: T[]): T[] {
  return items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/** Firestore orderBy omite docs sem sortOrder; o painel usa get() — alinhar com o bot. */
async function fetchCatalogItems(
  businessId: string,
  opts?: { availableOnly?: boolean }
): Promise<CatalogItem[]> {
  const snap = await catalogCol(businessId).get();
  let items = snap.docs.map((d) => {
    const data = d.data();
    return {
      ...data,
      id: d.id,
      businessId,
      sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : 0,
      available: data.available !== false,
    } as CatalogItem;
  });
  if (opts?.availableOnly) items = items.filter((i) => i.available);
  return sortBySortOrder(items);
}

async function fetchFaqs(businessId: string, opts?: { activeOnly?: boolean }): Promise<FAQ[]> {
  const snap = await faqsCol(businessId).get();
  let items = snap.docs.map((d) => {
    const data = d.data();
    return {
      ...data,
      id: d.id,
      businessId,
      sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : 0,
      active: data.active !== false,
    } as FAQ;
  });
  if (opts?.activeOnly) items = items.filter((f) => f.active);
  return sortBySortOrder(items);
}

function conversationsCol(businessId: string) {
  return businessRef(businessId).collection("conversations");
}

function messagesCol(businessId: string, conversationId: string) {
  return conversationsCol(businessId).doc(conversationId).collection("messages");
}

function appointmentsCol(businessId: string) {
  return businessRef(businessId).collection("appointments");
}

function paymentsCol(businessId: string) {
  return businessRef(businessId).collection("payments");
}

function scheduledStatusesCol(businessId: string) {
  return businessRef(businessId).collection("scheduledStatuses");
}

function asaasIntegrationRef(businessId: string) {
  return businessRef(businessId).collection("integrations").doc("asaas");
}

function phoneToJid(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return digits ? `${digits}@s.whatsapp.net` : null;
}

// ─── Tenants ─────────────────────────────────────────────────────────────────

export async function getTenant(id: string): Promise<Tenant | null> {
  const snap = await tenants().doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as Tenant) : null;
}

export async function getTenantByEmail(email: string): Promise<Tenant | null> {
  const snap = await tenants().where("email", "==", email).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0]!;
  return { id: doc.id, ...doc.data() } as Tenant;
}

export async function getTenantByStripeCustomerId(customerId: string): Promise<Tenant | null> {
  const snap = await tenants().where("stripeCustomerId", "==", customerId).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0]!;
  return { id: doc.id, ...doc.data() } as Tenant;
}

export async function createTenant(
  id: string,
  data: { name: string; email: string; plan?: Plan; planStatus?: PlanStatus }
): Promise<Tenant> {
  const ts = nowIso();
  const trialEnds = new Date();
  trialEnds.setDate(trialEnds.getDate() + STARTER_TRIAL_DAYS);
  const tenant: Tenant = {
    id,
    name: data.name,
    email: data.email,
    plan: data.plan ?? "STARTER",
    planStatus: data.planStatus ?? "TRIALING",
    trialEndsAt: trialEnds.toISOString(),
    createdAt: ts,
    updatedAt: ts,
  };
  await tenants().doc(id).set(tenant);
  return tenant;
}

export async function updateTenant(
  id: string,
  data: Partial<Tenant>
): Promise<Tenant | null> {
  const existing = await getTenant(id);
  if (!existing) return null;
  const patch = { ...data, updatedAt: nowIso() };
  delete (patch as { id?: string }).id;
  await tenants().doc(id).update(patch);
  return { ...existing, ...patch } as Tenant;
}

// ─── Businesses ──────────────────────────────────────────────────────────────

export async function listBusinesses(tenantId: string): Promise<Business[]> {
  const snap = await businesses().where("tenantId", "==", tenantId).get();
  return snap.docs.map((d) =>
    normalizeBusiness(d.id, d.data() as Record<string, unknown>)
  );
}

export async function getBusiness(id: string, tenantId?: string): Promise<Business | null> {
  const snap = await businessRef(id).get();
  if (!snap.exists) return null;
  const b = normalizeBusiness(snap.id, snap.data() as Record<string, unknown>);
  if (tenantId && b.tenantId !== tenantId) return null;
  return b;
}

export async function getBusinessWithRelations(
  id: string,
  tenantId?: string
): Promise<BusinessWithRelations | null> {
  const business = await getBusiness(id, tenantId);
  if (!business) return null;
  const [catalog, faqs] = await Promise.all([fetchCatalogItems(id), fetchFaqs(id)]);
  const tenant = await getTenant(business.tenantId);
  return { ...business, catalog, faqs, tenantPlan: tenant?.plan };
}

async function resolveCatalogForBot(business: Business): Promise<CatalogItem[]> {
  const tryIds = [business.id, ...(business.id !== "app" ? ["app"] : [])];
  for (const bid of tryIds) {
    const items = await fetchCatalogItems(bid);
    if (items.length > 0) return items.map((i) => ({ ...i, businessId: business.id }));
  }
  return [];
}

async function resolveFaqsForBot(business: Business): Promise<FAQ[]> {
  const tryIds = [business.id, ...(business.id !== "app" ? ["app"] : [])];
  for (const bid of tryIds) {
    const items = await fetchFaqs(bid, { activeOnly: true });
    if (items.length > 0) return items.map((f) => ({ ...f, businessId: business.id }));
  }
  return [];
}

export async function getBusinessAsaasIntegration(
  businessId: string
): Promise<BusinessAsaasIntegration | null> {
  const snap = await asaasIntegrationRef(businessId).get();
  if (!snap.exists) return null;
  const data = snap.data() as BusinessAsaasIntegration;
  if (!data.apiKey?.trim()) return null;
  return data;
}

export async function setBusinessAsaasIntegration(
  businessId: string,
  data: { apiKey: string; sandbox?: boolean; webhookToken?: string }
): Promise<BusinessAsaasIntegration> {
  const record: BusinessAsaasIntegration = {
    apiKey: data.apiKey.trim(),
    sandbox: data.sandbox === true,
    updatedAt: nowIso(),
  };
  const token = data.webhookToken?.trim();
  if (token) record.webhookToken = token;
  await asaasIntegrationRef(businessId).set(record);
  return record;
}

export async function deleteBusinessAsaasIntegration(businessId: string): Promise<void> {
  await asaasIntegrationRef(businessId).delete();
}

export async function getBusinessForBot(id: string): Promise<BusinessWithRelations | null> {
  const business = await getBusiness(id);
  if (!business) return null;
  const [catalog, faqs, asaas, schedule] = await Promise.all([
    resolveCatalogForBot(business),
    resolveFaqsForBot(business),
    getBusinessAsaasIntegration(id),
    getBusinessSchedule(id),
  ]);
  const tenant = await getTenant(business.tenantId);
  const operating = resolveBotOperatingContext(business, schedule);
  return {
    ...business,
    ...operating,
    catalog,
    faqs,
    tenantPlan: tenant?.plan,
    asaasConfigured: Boolean(asaas?.apiKey),
  };
}

export async function createBusiness(
  tenantId: string,
  data: BusinessCreateInput
): Promise<Business> {
  const id = newId();
  const ts = nowIso();
  const record = buildBusinessCreateRecord(tenantId, id, data, ts);
  await businessRef(id).set(record);
  return normalizeBusiness(id, record);
}

export async function updateBusiness(
  id: string,
  tenantId: string,
  data: Partial<Business>
): Promise<Business | null> {
  const exists = await getBusiness(id, tenantId);
  if (!exists) return null;
  const patch: Record<string, unknown> = removeUndefined({ ...data, updatedAt: nowIso() });
  delete patch.id;
  delete patch.tenantId;
  if (patch.leadFlow && typeof patch.leadFlow === "object") {
    const normalized = normalizeLeadCaptureFlow(patch.leadFlow as LeadCaptureFlow);
    const tenant = await getTenant(tenantId);
    assertLeadFlowMediaQuota(normalized, (tenant?.plan ?? "STARTER") as PlanTier);
    patch.leadFlow = serializeLeadFlowForFirestore(normalized);
  }
  if (patch.type && patch.type !== "OTHER") patch.typeLabel = AdminFieldValue.delete();
  else if (typeof patch.typeLabel === "string") patch.typeLabel = patch.typeLabel.trim() || AdminFieldValue.delete();
  await businessRef(id).update(patch);
  return getBusiness(id, tenantId);
}

export async function setBusinessConnected(id: string, isConnected: boolean): Promise<void> {
  await businessRef(id).update({ isConnected, updatedAt: nowIso() });
}

// ─── Catalog ─────────────────────────────────────────────────────────────────

export async function listCatalog(businessId: string): Promise<CatalogItem[]> {
  return fetchCatalogItems(businessId);
}

export async function createCatalogItem(
  businessId: string,
  data: Omit<CatalogItem, "id" | "businessId" | "createdAt">
): Promise<CatalogItem> {
  const id = newId();
  const item: CatalogItem = { id, businessId, createdAt: nowIso(), ...data };
  await catalogCol(businessId).doc(id).set(item);
  return item;
}

export async function updateCatalogItem(
  businessId: string,
  itemId: string,
  data: Partial<CatalogItem>
): Promise<CatalogItem | null> {
  const ref = catalogCol(businessId).doc(itemId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.update(data);
  return { id: itemId, businessId, ...snap.data(), ...data } as CatalogItem;
}

export async function deleteCatalogItem(businessId: string, itemId: string): Promise<void> {
  await catalogCol(businessId).doc(itemId).delete();
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

export async function listFaqs(businessId: string): Promise<FAQ[]> {
  return fetchFaqs(businessId);
}

export async function createFaq(
  businessId: string,
  data: Omit<FAQ, "id" | "businessId" | "createdAt" | "sortOrder"> & { sortOrder?: number }
): Promise<FAQ> {
  const id = newId();
  const faq: FAQ = {
    id,
    businessId,
    sortOrder: data.sortOrder ?? 0,
    createdAt: nowIso(),
    ...data,
  };
  await faqsCol(businessId).doc(id).set(faq);
  return faq;
}

export async function updateFaq(
  businessId: string,
  faqId: string,
  data: Partial<Omit<FAQ, "id" | "businessId" | "createdAt">>
): Promise<FAQ | null> {
  const ref = faqsCol(businessId).doc(faqId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.update(data);
  return { id: faqId, businessId, ...snap.data(), ...data } as FAQ;
}

export async function deleteFaq(businessId: string, faqId: string): Promise<void> {
  await faqsCol(businessId).doc(faqId).delete();
}

// ─── Conversations ───────────────────────────────────────────────────────────

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

function customerConversationKey(phone: string): string {
  const raw = phone.trim().toLowerCase();
  if (raw.includes("@lid")) {
    const id = raw.split("@")[0]?.replace(/\D/g, "") ?? "";
    return id ? `lid:${id}` : raw;
  }
  const digits = normalizePhoneDigits(raw);
  if (digits.length >= 10) return `tel:${digits.slice(-11)}`;
  return digits ? `tel:${digits}` : raw;
}

function customerPhonesMatch(a: string, b: string): boolean {
  if (customerConversationKey(a) === customerConversationKey(b)) return true;
  const da = normalizePhoneDigits(a);
  const db = normalizePhoneDigits(b);
  if (!da || !db) return false;
  if (da === db) return true;
  if (da.length >= 10 && db.length >= 10) return da.slice(-10) === db.slice(-10);
  return da.endsWith(db) || db.endsWith(da);
}

async function findConversationDoc(businessId: string, customerPhone: string) {
  const col = conversationsCol(businessId);
  const key = customerConversationKey(customerPhone);

  const byKey = await col.where("customerKey", "==", key).limit(1).get();
  if (!byKey.empty) return byKey.docs[0]!;

  const exact = await col.where("customerPhone", "==", customerPhone).limit(1).get();
  if (!exact.empty) return exact.docs[0]!;

  const all = await col.get();
  return all.docs.find((d) => customerPhonesMatch(String(d.data().customerPhone ?? ""), customerPhone)) ?? null;
}

export async function mergeDuplicateConversations(businessId: string): Promise<number> {
  const col = conversationsCol(businessId);
  const snap = await col.get();
  const groups = new Map<string, QueryDocumentSnapshot[]>();

  for (const doc of snap.docs) {
    const phone = String(doc.data().customerPhone ?? "");
    const key = String(doc.data().customerKey ?? customerConversationKey(phone));
    const list = groups.get(key) ?? [];
    list.push(doc);
    groups.set(key, list);
  }

  let mergedGroups = 0;
  const db = getDb();

  for (const [key, docs] of groups) {
    if (docs.length <= 1) {
      const only = docs[0]!;
      if (!only.data().customerKey) await only.ref.update({ customerKey: key });
      continue;
    }

    mergedGroups += 1;

    const scored = await Promise.all(
      docs.map(async (doc) => {
        const msgSnap = await messagesCol(businessId, doc.id).get();
        return { doc, msgCount: msgSnap.size };
      })
    );

    scored.sort((a, b) => {
      if (b.msgCount !== a.msgCount) return b.msgCount - a.msgCount;
      return String(b.doc.data().lastMessageAt ?? "").localeCompare(String(a.doc.data().lastMessageAt ?? ""));
    });

    const primary = scored[0]!.doc;
    const primaryId = primary.id;

    for (const { doc } of scored.slice(1)) {
      const dupId = doc.id;
      const msgSnap = await messagesCol(businessId, dupId).get();
      if (!msgSnap.empty) {
        const batch = db.batch();
        for (const msgDoc of msgSnap.docs) {
          const data = msgDoc.data();
          const nextId = newId();
          batch.set(messagesCol(businessId, primaryId).doc(nextId), {
            ...data,
            id: nextId,
            conversationId: primaryId,
          });
          batch.delete(msgDoc.ref);
        }
        await batch.commit();
      }

      const apts = await appointmentsCol(businessId).where("conversationId", "==", dupId).get();
      for (const apt of apts.docs) await apt.ref.update({ conversationId: primaryId });

      const pays = await paymentsCol(businessId).where("conversationId", "==", dupId).get();
      for (const pay of pays.docs) await pay.ref.update({ conversationId: primaryId });

      await doc.ref.delete();
    }

    const bestName = scored.reduce<string | undefined>((best, { doc }) => {
      const name = String(doc.data().customerName ?? "").trim();
      if (name && (!best || name.length > best.length)) return name;
      return best;
    }, String(primary.data().customerName ?? "").trim() || undefined);

    const bestReplyJid = scored.reduce<string | undefined>((best, { doc }) => {
      const reply = String(doc.data().replyJid ?? doc.data().customerPhone ?? "").trim();
      if (reply.includes("@")) return reply;
      return best;
    }, String(primary.data().replyJid ?? "").trim() || undefined);

    await primary.ref.update({
      customerKey: key,
      customerName: bestName,
      replyJid: bestReplyJid,
      lastMessageAt: nowIso(),
    });
  }

  return mergedGroups;
}

export async function listConversations(
  businessId: string,
  opts?: { status?: ConversationStatus; page?: number; limit?: number }
): Promise<{ conversations: (Conversation & { messages?: Message[] })[]; total: number }> {
  await mergeDuplicateConversations(businessId).catch(() => undefined);

  let q: Query = conversationsCol(businessId).orderBy("lastMessageAt", "desc");
  if (opts?.status) q = q.where("status", "==", opts.status);
  const snap = await q.get();
  const all = snap.docs.map((d) => ({ id: d.id, businessId, ...d.data() }) as Conversation);
  const page = opts?.page ?? 1;
  const limit = opts?.limit ?? 20;
  const start = (page - 1) * limit;
  const slice = all.slice(start, start + limit);
  const withLast = await Promise.all(
    slice.map(async (c) => {
      const msgs = await messagesCol(businessId, c.id).orderBy("createdAt", "desc").limit(1).get();
      const messages = msgs.docs.map((d) => ({
        id: d.id,
        conversationId: c.id,
        ...d.data(),
      })) as Message[];
      return { ...c, messages };
    })
  );
  return { conversations: withLast, total: all.length };
}

export async function getConversation(
  businessId: string,
  conversationId: string
): Promise<(Conversation & { messages: Message[]; appointments: Appointment[]; payments: Payment[] }) | null> {
  const snap = await conversationsCol(businessId).doc(conversationId).get();
  if (!snap.exists) return null;
  const conversation = { id: snap.id, businessId, ...snap.data() } as Conversation;
  const [msgsSnap, aptsSnap, paysSnap] = await Promise.all([
    messagesCol(businessId, conversationId).orderBy("createdAt", "asc").get(),
    appointmentsCol(businessId).where("conversationId", "==", conversationId).get(),
    paymentsCol(businessId).where("conversationId", "==", conversationId).get(),
  ]);
  return {
    ...conversation,
    messages: msgsSnap.docs.map((d) => ({ id: d.id, conversationId, ...d.data() }) as Message),
    appointments: aptsSnap.docs.map((d) => ({ id: d.id, businessId, ...d.data() }) as Appointment),
    payments: paysSnap.docs.map((d) => ({ id: d.id, businessId, ...d.data() }) as Payment),
  };
}

export async function upsertConversation(
  businessId: string,
  customerPhone: string,
  customerName?: string,
  replyJid?: string
): Promise<Conversation> {
  const key = customerConversationKey(customerPhone);
  const ts = nowIso();
  const dest = replyJid?.trim() || customerPhone;
  const stableId = `c_${key.replace(/[^a-zA-Z0-9]/g, "_")}`;

  const existing = await findConversationDoc(businessId, customerPhone);
  if (existing) {
    const patch: Record<string, unknown> = {
      customerName: customerName ?? existing.data().customerName,
      lastMessageAt: ts,
      customerKey: key,
    };
    const prevReply = String(existing.data().replyJid ?? "").trim();
    if (dest.includes("@lid")) patch.replyJid = dest;
    else if (dest.includes("@") && !prevReply.includes("@lid")) patch.replyJid = dest;
    await existing.ref.update(patch);
    return { id: existing.id, businessId, ...existing.data(), ...patch } as Conversation;
  }

  const ref = conversationsCol(businessId).doc(stableId);
  return getDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      const data = snap.data() as Conversation;
      const patch: Record<string, unknown> = {
        customerName: customerName ?? data.customerName,
        lastMessageAt: ts,
        customerKey: key,
      };
      const prevReply = String(data.replyJid ?? "").trim();
      if (dest.includes("@lid")) patch.replyJid = dest;
      else if (dest.includes("@") && !prevReply.includes("@lid")) patch.replyJid = dest;
      tx.update(ref, patch);
      return { ...data, ...patch, id: stableId, businessId } as Conversation;
    }

    const conversation: Conversation = {
      id: stableId,
      businessId,
      customerPhone,
      customerKey: key,
      replyJid: dest.includes("@") ? dest : undefined,
      customerName,
      status: "OPEN",
      lastMessageAt: ts,
      createdAt: ts,
    };
    tx.set(ref, conversation);
    return conversation;
  });
}

export async function updateConversationStatus(
  businessId: string,
  conversationId: string,
  status: ConversationStatus
): Promise<Conversation | null> {
  const ref = conversationsCol(businessId).doc(conversationId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  await ref.update({ status, lastMessageAt: nowIso() });
  return { id: conversationId, businessId, ...snap.data(), status } as Conversation;
}

export async function setConversationBotFlowState(
  businessId: string,
  conversationId: string,
  state: { step: string; data: Record<string, string> }
): Promise<void> {
  await conversationsCol(businessId).doc(conversationId).update({
    botFlowState: state,
    lastMessageAt: nowIso(),
  });
}

export async function clearConversationBotFlowState(
  businessId: string,
  conversationId: string
): Promise<void> {
  await conversationsCol(businessId).doc(conversationId).update({
    botFlowState: AdminFieldValue.delete(),
    lastMessageAt: nowIso(),
  });
}

function botClosedLockRef(businessId: string, customerKey: string) {
  const safe = customerKey.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
  return businessRef(businessId).collection("botLocks").doc(`closed_${safe}`);
}

export async function clearOutsideHoursNotice(
  businessId: string,
  customerPhone: string
): Promise<void> {
  const customerKey = customerConversationKey(customerPhone);
  await botClosedLockRef(businessId, customerKey).delete().catch(() => undefined);
  const existing = await findConversationDoc(businessId, customerPhone);
  if (existing?.data()?.outsideHoursNoticeAt) {
    await existing.ref.update({ outsideHoursNoticeAt: AdminFieldValue.delete() });
  }
}

export async function tryClaimOutsideHoursNotice(
  businessId: string,
  customerPhone: string
): Promise<boolean> {
  const customerKey = customerConversationKey(customerPhone);
  const ref = botClosedLockRef(businessId, customerKey);
  try {
    return await getDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists && snap.data()?.active === true) return false;
      tx.set(ref, { active: true, customerKey, at: nowIso() }, { merge: true });
      return true;
    });
  } catch {
    return false;
  }
}

function botGreetingReplyLockRef(businessId: string, customerKey: string) {
  const safe = customerKey.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
  return businessRef(businessId).collection("botLocks").doc(`greet_${safe}`);
}

const CHAT_GREETING_REPLY_COOLDOWN_MS = 120_000;

export async function tryClaimChatGreetingReply(
  businessId: string,
  customerPhone: string,
  cooldownMs = CHAT_GREETING_REPLY_COOLDOWN_MS
): Promise<boolean> {
  const customerKey = customerConversationKey(customerPhone);
  const ref = botGreetingReplyLockRef(businessId, customerKey);
  const now = Date.now();
  try {
    return await getDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const last = String(snap.data()?.repliedAt ?? "");
      if (last) {
        const lastMs = new Date(last).getTime();
        if (Number.isFinite(lastMs) && now - lastMs < cooldownMs) return false;
      }
      tx.set(ref, { repliedAt: new Date(now).toISOString(), customerKey }, { merge: true });
      return true;
    });
  } catch {
    return false;
  }
}

export type LeadFlowIdleFollowUpStatus = "pending" | "sent" | "cancelled";

export interface LeadFlowIdleFollowUp {
  businessId: string;
  conversationId: string;
  customerPhone: string;
  replyJid: string;
  customerName?: string;
  nodeId?: string;
  visitId?: string;
  dueAt: string;
  anchorAt: string;
  message: string;
  status: LeadFlowIdleFollowUpStatus;
}

function leadFlowIdleFollowUpsCol(businessId: string) {
  return businessRef(businessId).collection("leadFlowIdleFollowUps");
}

export async function scheduleLeadFlowIdleFollowUp(
  businessId: string,
  data: Omit<LeadFlowIdleFollowUp, "businessId" | "status">
): Promise<void> {
  const ts = nowIso();
  await leadFlowIdleFollowUpsCol(businessId)
    .doc(data.conversationId)
    .set({
      ...data,
      businessId,
      status: "pending" satisfies LeadFlowIdleFollowUpStatus,
      updatedAt: ts,
    });
}

export async function clearLeadFlowIdleFollowUp(
  businessId: string,
  conversationId: string
): Promise<void> {
  const ref = leadFlowIdleFollowUpsCol(businessId).doc(conversationId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const status = String(snap.data()?.status ?? "");
  if (status !== "pending") return;
  await ref.update({ status: "cancelled", updatedAt: nowIso() }).catch(() => undefined);
}

export async function markLeadFlowIdleFollowUpSent(
  businessId: string,
  conversationId: string
): Promise<void> {
  await leadFlowIdleFollowUpsCol(businessId)
    .doc(conversationId)
    .update({ status: "sent", sentAt: nowIso(), updatedAt: nowIso() })
    .catch(() => undefined);
}

export async function tryClaimLeadFlowIdleFollowUp(
  businessId: string,
  conversationId: string
): Promise<LeadFlowIdleFollowUp | null> {
  const ref = leadFlowIdleFollowUpsCol(businessId).doc(conversationId);
  const now = nowIso();
  try {
    return await getDb().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      const row = snap.data()!;
      if (String(row.status ?? "") !== "pending") return null;
      if (String(row.dueAt ?? "") > now) return null;
      const ts = nowIso();
      tx.update(ref, { status: "sent", sentAt: ts, updatedAt: ts });
      return {
        businessId,
        conversationId: String(row.conversationId ?? conversationId),
        customerPhone: String(row.customerPhone ?? ""),
        replyJid: String(row.replyJid ?? row.customerPhone ?? ""),
        customerName: row.customerName ? String(row.customerName) : undefined,
        nodeId: row.nodeId ? String(row.nodeId) : undefined,
        visitId: row.visitId ? String(row.visitId) : undefined,
        dueAt: String(row.dueAt ?? ""),
        anchorAt: String(row.anchorAt ?? ""),
        message: String(row.message ?? ""),
        status: "sent",
      };
    });
  } catch {
    return null;
  }
}

export async function hasCustomerMessageSince(
  businessId: string,
  conversationId: string,
  sinceIso: string
): Promise<boolean> {
  const snap = await messagesCol(businessId, conversationId)
    .orderBy("createdAt", "desc")
    .limit(30)
    .get();
  return snap.docs.some((doc) => {
    const row = doc.data();
    return row.role === "CUSTOMER" && String(row.createdAt ?? "") > sinceIso;
  });
}

export async function listDueLeadFlowIdleFollowUps(limit = 25): Promise<LeadFlowIdleFollowUp[]> {
  const now = nowIso();
  const businessSnap = await businesses().select().get();
  const out: LeadFlowIdleFollowUp[] = [];

  for (const businessDoc of businessSnap.docs) {
    if (out.length >= limit) break;
    const snap = await leadFlowIdleFollowUpsCol(businessDoc.id)
      .where("status", "==", "pending")
      .get();
    for (const doc of snap.docs) {
      if (out.length >= limit) break;
      const row = doc.data();
      const dueAt = String(row.dueAt ?? "");
      if (!dueAt || dueAt > now) continue;
      out.push({
        businessId: businessDoc.id,
        conversationId: String(row.conversationId ?? doc.id),
        customerPhone: String(row.customerPhone ?? ""),
        replyJid: String(row.replyJid ?? row.customerPhone ?? ""),
        customerName: row.customerName ? String(row.customerName) : undefined,
        nodeId: row.nodeId ? String(row.nodeId) : undefined,
        visitId: row.visitId ? String(row.visitId) : undefined,
        dueAt: String(row.dueAt ?? ""),
        anchorAt: String(row.anchorAt ?? ""),
        message: String(row.message ?? ""),
        status: "pending",
      });
    }
  }

  return out.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export async function createMessage(
  businessId: string,
  conversationId: string,
  data: Omit<Message, "id" | "conversationId" | "createdAt">
): Promise<Message> {
  const id = newId();
  const ts = nowIso();
  const message: Message = { id, conversationId, createdAt: ts, ...data };
  await messagesCol(businessId, conversationId).doc(id).set(message);
  await conversationsCol(businessId).doc(conversationId).update({ lastMessageAt: ts });
  return message;
}

export async function createMessages(
  businessId: string,
  conversationId: string,
  items: Omit<Message, "id" | "conversationId" | "createdAt">[]
): Promise<void> {
  const batch = getDb().batch();
  const ts = nowIso();
  for (const item of items) {
    const id = newId();
    batch.set(messagesCol(businessId, conversationId).doc(id), {
      id,
      conversationId,
      createdAt: ts,
      ...item,
    });
  }
  batch.update(conversationsCol(businessId).doc(conversationId), { lastMessageAt: ts });
  await batch.commit();
}

// ─── Appointments ────────────────────────────────────────────────────────────

const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = ["PENDING", "CONFIRMED"];

function appointmentOverlaps(
  scheduledAt: string,
  durationMins: number,
  other: Appointment
): boolean {
  const startA = new Date(scheduledAt).getTime();
  const endA = startA + durationMins * 60_000;
  const startB = new Date(other.scheduledAt).getTime();
  const endB = startB + (other.durationMins ?? 60) * 60_000;
  return startA < endB && startB < endA;
}

export async function findConflictingAppointment(
  businessId: string,
  scheduledAt: string,
  durationMins = 60
): Promise<Appointment | null> {
  const appointments = await listAppointments(businessId);
  for (const apt of appointments) {
    if (!ACTIVE_APPOINTMENT_STATUSES.includes(apt.status)) continue;
    if (appointmentOverlaps(scheduledAt, durationMins, apt)) return apt;
  }
  return null;
}

export async function listCustomerAppointments(
  businessId: string,
  customerPhone: string,
  opts?: { upcomingOnly?: boolean }
): Promise<Appointment[]> {
  const now = Date.now();
  const appointments = await listAppointments(businessId);
  return appointments
    .filter((a) => customerPhonesMatch(a.customerPhone, customerPhone))
    .filter((a) => a.status !== "CANCELLED" && a.status !== "NO_SHOW")
    .filter((a) => !opts?.upcomingOnly || new Date(a.scheduledAt).getTime() >= now)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

export async function listAppointments(
  businessId: string,
  opts?: { from?: string; to?: string; status?: AppointmentStatus }
): Promise<Appointment[]> {
  const snap = await appointmentsCol(businessId).orderBy("scheduledAt", "asc").get();
  let list = snap.docs.map((d) => ({ id: d.id, businessId, ...d.data() }) as Appointment);
  if (opts?.status) list = list.filter((a) => a.status === opts.status);
  if (opts?.from) list = list.filter((a) => a.scheduledAt >= opts.from!);
  if (opts?.to) list = list.filter((a) => a.scheduledAt <= opts.to!);
  return list;
}

export async function createAppointment(
  data: Omit<Appointment, "id" | "createdAt" | "updatedAt" | "reminderSent">
): Promise<Appointment> {
  const id = newId();
  const ts = nowIso();
  const apt: Appointment = { id, reminderSent: false, createdAt: ts, updatedAt: ts, ...data };
  await appointmentsCol(data.businessId).doc(id).set(apt);
  return apt;
}

export async function getAppointment(
  businessId: string,
  appointmentId: string
): Promise<Appointment | null> {
  const snap = await appointmentsCol(businessId).doc(appointmentId).get();
  if (!snap.exists) return null;
  return { id: snap.id, businessId, ...snap.data() } as Appointment;
}

export async function updateAppointment(
  businessId: string,
  appointmentId: string,
  data: Partial<Appointment>
): Promise<Appointment | null> {
  const ref = appointmentsCol(businessId).doc(appointmentId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const patch = { ...data, updatedAt: nowIso() };
  await ref.update(patch);
  return { id: appointmentId, businessId, ...snap.data(), ...patch } as Appointment;
}

// ─── Payments ────────────────────────────────────────────────────────────────

export async function createPayment(
  data: Omit<Payment, "id" | "createdAt" | "updatedAt">
): Promise<Payment> {
  const id = newId();
  const ts = nowIso();
  const payment: Payment = { id, createdAt: ts, updatedAt: ts, ...data };
  await paymentsCol(data.businessId).doc(id).set(payment);
  return payment;
}

export async function getPaymentsByAsaasId(asaasId: string): Promise<Payment[]> {
  const snap = await getDb().collectionGroup("payments").where("asaasId", "==", asaasId).get();
  return snap.docs.map((d) => {
    const businessId = d.ref.parent.parent!.id;
    return { id: d.id, businessId, ...d.data() } as Payment;
  });
}

export async function updatePaymentsByAsaasId(
  asaasId: string,
  data: Partial<Payment>
): Promise<Payment[]> {
  const snap = await getDb().collectionGroup("payments").where("asaasId", "==", asaasId).get();
  if (snap.empty) return [];

  const batch = getDb().batch();
  const updated: Payment[] = [];
  const ts = nowIso();

  for (const doc of snap.docs) {
    const businessId = doc.ref.parent.parent!.id;
    const current = { id: doc.id, businessId, ...doc.data() } as Payment;
    const patch = { ...data, updatedAt: ts };
    batch.update(doc.ref, patch);
    updated.push({ ...current, ...patch } as Payment);
  }

  await batch.commit();
  return updated;
}

export async function listPayments(businessId: string, limit = 50): Promise<Payment[]> {
  const snap = await paymentsCol(businessId).orderBy("createdAt", "desc").limit(limit).get();
  return snap.docs.map((d) => ({ id: d.id, businessId, ...d.data() }) as Payment);
}

// ─── Scheduled WhatsApp status ───────────────────────────────────────────────

export async function listScheduledStatuses(businessId: string): Promise<ScheduledStatus[]> {
  const snap = await scheduledStatusesCol(businessId).orderBy("scheduledAt", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, businessId, ...d.data() }) as ScheduledStatus);
}

export async function listDueScheduledStatuses(limit = 25): Promise<ScheduledStatus[]> {
  const snap = await getDb()
    .collectionGroup("scheduledStatuses")
    .where("status", "==", "scheduled")
    .where("scheduledAt", "<=", nowIso())
    .orderBy("scheduledAt", "asc")
    .limit(limit)
    .get();
  const rows = snap.docs.map((d) => {
    const businessId = d.ref.parent.parent?.id ?? "";
    return { id: d.id, businessId, ...d.data() } as ScheduledStatus;
  });
  return rows.sort(
    (a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.createdAt.localeCompare(b.createdAt)
  );
}

export async function claimScheduledStatus(
  businessId: string,
  id: string
): Promise<ScheduledStatus | null> {
  const ref = scheduledStatusesCol(businessId).doc(id);
  return getDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const row = { id: snap.id, businessId, ...snap.data() } as ScheduledStatus;
    if (row.status !== "scheduled") return null;
    const ts = nowIso();
    tx.update(ref, { status: "publishing" satisfies ScheduledStatusState, updatedAt: ts });
    return { ...row, status: "publishing", updatedAt: ts };
  });
}

export async function finishScheduledStatus(
  businessId: string,
  id: string,
  outcome:
    | { status: "published"; waMessageId?: string }
    | { status: "failed"; error: string }
) {
  const ts = nowIso();
  const patch: Record<string, unknown> = { status: outcome.status, updatedAt: ts };
  if (outcome.status === "published") {
    patch.publishedAt = ts;
    if (outcome.waMessageId) patch.waMessageId = outcome.waMessageId;
  }
  if (outcome.status === "failed") patch.error = outcome.error.slice(0, 500);
  await scheduledStatusesCol(businessId).doc(id).update(patch);
  if (outcome.status === "published") {
    const business = await getBusiness(businessId);
    if (business?.tenantId) await recordTenantStoryPublished(business.tenantId);
  }
}

export async function deferScheduledStatus(
  businessId: string,
  id: string,
  delayMs: number
): Promise<boolean> {
  const ref = scheduledStatusesCol(businessId).doc(id);
  return getDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const row = snap.data() as ScheduledStatus;
    const retries = typeof row.retryCount === "number" ? row.retryCount : 0;
    if (retries >= 5) return false;
    const ts = nowIso();
    tx.update(ref, {
      status: "scheduled" satisfies ScheduledStatusState,
      scheduledAt: new Date(Date.now() + delayMs).toISOString(),
      retryCount: retries + 1,
      updatedAt: ts,
      error: AdminFieldValue.delete(),
    });
    return true;
  });
}

const REPOSTABLE_STATUS: ScheduledStatus["status"][] = ["published", "failed", "cancelled"];

async function assertStoriesQuotaForCreate(tenantId: string) {
  const tenant = await getTenant(tenantId);
  const plan = (tenant?.plan ?? "STARTER") as PlanTier;
  const published = await getTenantStoriesPublished(tenantId);
  assertStoriesPublishQuota(plan, published);
}

export async function createScheduledStatuses(
  businessId: string,
  tenantId: string,
  data: {
    mediaUrl: string;
    mediaStoragePath?: string;
    mediaType: ScheduledStatusMediaType;
    caption?: string;
    scheduledAts: string[];
    sourceStatusId?: string;
    seriesId?: string;
    publishNow?: boolean;
  }
): Promise<ScheduledStatus[]> {
  if (!data.scheduledAts.length) throw new Error("Informe pelo menos um horário.");
  await assertStoriesQuotaForCreate(tenantId);

  const seriesId = data.seriesId ?? (data.scheduledAts.length > 1 ? newId() : undefined);
  const ts = nowIso();
  const batch = getDb().batch();
  const rows: ScheduledStatus[] = [];
  for (const scheduledAt of data.scheduledAts) {
    const atIso = data.publishNow ? nowIso() : scheduledAt;
    const at = new Date(atIso).getTime();
    if (!Number.isFinite(at)) {
      throw new Error("Horário de agendamento inválido.");
    }
    if (!data.publishNow && at < Date.now() + 60_000) {
      throw new Error("Todos os horários devem ser pelo menos 1 minuto no futuro.");
    }
    const id = newId();
    const row = removeUndefined({
      id,
      businessId,
      mediaUrl: data.mediaUrl,
      mediaStoragePath: data.mediaStoragePath,
      mediaType: data.mediaType,
      caption: data.caption?.trim() || undefined,
      scheduledAt: new Date(atIso).toISOString(),
      status: "scheduled",
      seriesId,
      sourceStatusId: data.sourceStatusId,
      createdAt: ts,
      updatedAt: ts,
    }) as ScheduledStatus;
    batch.set(scheduledStatusesCol(businessId).doc(id), row);
    rows.push(row);
  }

  await batch.commit();
  return rows.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

export async function createScheduledStatus(
  businessId: string,
  tenantId: string,
  input: {
    mediaUrl: string;
    mediaStoragePath?: string;
    mediaType: ScheduledStatusMediaType;
    caption?: string;
    scheduledDays: string[];
    hour: number;
    minute: number;
    publishNow?: boolean;
  }
): Promise<ScheduledStatus[]> {
  const business = await getBusiness(businessId);
  const scheduledAts = resolveStoryScheduledAts({
    ...input,
    timezone: business?.timezone ?? "America/Sao_Paulo",
  });
  return createScheduledStatuses(businessId, tenantId, {
    mediaUrl: input.mediaUrl,
    mediaStoragePath: input.mediaStoragePath,
    mediaType: input.mediaType,
    caption: input.caption,
    scheduledAts,
    publishNow: input.publishNow,
  });
}

export async function repostScheduledStatus(
  businessId: string,
  tenantId: string,
  sourceStatusId: string,
  input: { scheduledDays: string[]; hour: number; minute: number; publishNow?: boolean }
): Promise<ScheduledStatus[]> {
  const ref = scheduledStatusesCol(businessId).doc(sourceStatusId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Status não encontrado.");
  const source = { id: snap.id, businessId, ...snap.data() } as ScheduledStatus;
  if (!REPOSTABLE_STATUS.includes(source.status)) {
    throw new Error("Só é possível reagendar status já publicados, cancelados ou com falha.");
  }
  if (!source.mediaUrl) throw new Error("Arte original indisponível para reagendar.");

  const business = await getBusiness(businessId);
  const scheduledAts = resolveStoryScheduledAts({
    ...input,
    timezone: business?.timezone ?? "America/Sao_Paulo",
  });

  return createScheduledStatuses(businessId, tenantId, {
    mediaUrl: source.mediaUrl,
    mediaStoragePath: source.mediaStoragePath,
    mediaType: source.mediaType,
    caption: source.caption,
    scheduledAts,
    sourceStatusId: source.id,
    publishNow: input.publishNow,
  });
}

export async function cancelScheduledStatus(
  businessId: string,
  statusId: string
): Promise<void> {
  const ref = scheduledStatusesCol(businessId).doc(statusId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Agendamento não encontrado.");
  const row = snap.data() as ScheduledStatus;
  if (row.status !== "scheduled") {
    throw new Error("Só é possível cancelar publicações ainda não enviadas.");
  }
  await ref.delete();
}

export async function revokePublishedScheduledStatus(
  businessId: string,
  statusId: string
): Promise<void> {
  const ref = scheduledStatusesCol(businessId).doc(statusId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Agendamento não encontrado.");
  const row = snap.data() as ScheduledStatus;
  if (row.status !== "published") {
    throw new Error("Só é possível apagar stories já publicados.");
  }
  const ts = nowIso();
  await ref.update({ status: "cancelled", updatedAt: ts, revokedAt: ts });
}

export async function cancelScheduledStatusSeries(
  businessId: string,
  seriesId: string
): Promise<void> {
  const snap = await scheduledStatusesCol(businessId).orderBy("scheduledAt", "asc").get();
  const pending = snap.docs.filter((d) => {
    const row = d.data() as ScheduledStatus;
    return row.seriesId === seriesId && row.status === "scheduled";
  });
  if (!pending.length) throw new Error("Nenhum agendamento pendente nesta série.");
  const batch = getDb().batch();
  for (const d of pending) {
    batch.delete(d.ref);
  }
  await batch.commit();
}

export async function getScheduledStatus(
  businessId: string,
  statusId: string
): Promise<ScheduledStatus | null> {
  const snap = await scheduledStatusesCol(businessId).doc(statusId).get();
  if (!snap.exists) return null;
  return { id: snap.id, businessId, ...snap.data() } as ScheduledStatus;
}

export async function reclaimStuckPublishingStatuses(maxAgeMs = 5 * 60_000): Promise<number> {
  const businessSnap = await businesses().select().get();
  const cutoff = Date.now() - maxAgeMs;
  const ts = nowIso();
  let reclaimed = 0;

  for (const businessDoc of businessSnap.docs) {
    const publishingSnap = await scheduledStatusesCol(businessDoc.id)
      .where("status", "==", "publishing")
      .limit(20)
      .get();

    const stale = publishingSnap.docs.filter((d) => {
      const updated = String(d.data().updatedAt ?? "");
      if (!updated) return true;
      return new Date(updated).getTime() <= cutoff;
    });

    if (!stale.length) continue;

    const batch = getDb().batch();
    for (const d of stale) {
      batch.update(d.ref, {
        status: "scheduled",
        updatedAt: ts,
        error: AdminFieldValue.delete(),
      });
    }
    await batch.commit();
    reclaimed += stale.length;
  }

  return reclaimed;
}

export async function listStatusAudienceJids(businessId: string, max = 400): Promise<string[]> {
  const snap = await conversationsCol(businessId).get();
  const jids = new Set<string>();
  for (const d of snap.docs) {
    const c = d.data() as Conversation;
    const phone = c.customerPhone?.trim();
    if (phone) {
      const jid = phone.includes("@") ? phone : phoneToJid(phone);
      if (jid?.endsWith("@s.whatsapp.net")) jids.add(jid);
      continue;
    }
    const reply = c.replyJid?.trim();
    if (!reply) continue;
    const jid = reply.includes("@") ? reply : phoneToJid(reply);
    if (jid?.endsWith("@s.whatsapp.net")) jids.add(jid);
  }
  if (!jids.size) {
    const business = await getBusiness(businessId);
    const self = business?.phone ? phoneToJid(business.phone) : null;
    if (self) jids.add(self);
  }
  return [...jids].slice(0, max);
}

function tenantUsageRef(tenantId: string, ref = new Date()) {
  return tenants().doc(tenantId).collection("usage").doc(monthKey(ref));
}

export async function getTenantStoriesPublished(tenantId: string, ref = new Date()): Promise<number> {
  const snap = await tenantUsageRef(tenantId, ref).get();
  const n = snap.data()?.storiesPublished;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

async function recordTenantStoryPublished(tenantId: string) {
  const ref = tenantUsageRef(tenantId);
  const ts = nowIso();
  await ref.set(
    {
      month: monthKey(),
      storiesPublished: AdminFieldValue.increment(1),
      updatedAt: ts,
    },
    { merge: true }
  );
}

// ─── Analytics ─────────────────────────────────────────────────────────────

export async function getAnalytics(businessId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  const weekStartIso = weekStart.toISOString();
  const weekEndIso = weekEnd.toISOString();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const convCol = conversationsCol(businessId);
  const aptCol = appointmentsCol(businessId);
  const payCol = paymentsCol(businessId);

  const [
    convTotalSnap,
    convOpenSnap,
    monthConvSnap,
    lastMonthConvSnap,
    activeConvSnap,
    aptPendingSnap,
    aptMonthSnap,
    payPendingSnap,
    payMonthSnap,
  ] = await Promise.all([
    convCol.count().get(),
    convCol.where("status", "==", "OPEN").count().get(),
    convCol.where("createdAt", ">=", monthStart).where("createdAt", "<=", monthEnd).get(),
    convCol.where("createdAt", ">=", lastMonthStart).where("createdAt", "<=", lastMonthEnd).get(),
    convCol.where("lastMessageAt", ">=", monthStart).get(),
    aptCol.where("status", "in", ["PENDING", "CONFIRMED"]).get(),
    aptCol.where("scheduledAt", ">=", monthStart).where("scheduledAt", "<=", monthEnd).get(),
    payCol.where("status", "==", "PENDING").get(),
    payCol.where("status", "==", "PAID").get(),
  ]);

  const monthConversations = monthConvSnap.size;
  const lastMonthConversations = lastMonthConvSnap.size;
  const activeIds = new Set(activeConvSnap.docs.map((d) => d.id));
  const inactiveConvRefs = (await convCol.listDocuments()).filter((ref) => !activeIds.has(ref.id));

  const thisWeekByDaySets = Array.from({ length: 7 }, () => new Set<string>());
  const thisMonthByDaySets = Array.from({ length: daysInMonth }, () => new Set<string>());

  const [inactiveMsgCounts, activeMsgSnaps] = await Promise.all([
    Promise.all(
      inactiveConvRefs.map((ref) => messagesCol(businessId, ref.id).count().get())
    ),
    Promise.all(
      activeConvSnap.docs.map((c) =>
        messagesCol(businessId, c.id)
          .where("createdAt", ">=", monthStart)
          .where("createdAt", "<=", monthEnd)
          .get()
      )
    ),
  ]);

  let totalMessages = inactiveMsgCounts.reduce((sum, snap) => sum + snap.data().count, 0);
  let monthMessages = 0;

  for (let i = 0; i < activeConvSnap.docs.length; i++) {
    const convId = activeConvSnap.docs[i]!.id;
    const msgs = activeMsgSnaps[i]!;
    totalMessages += msgs.size;
    for (const m of msgs.docs) {
      const created = m.data().createdAt as string;
      monthMessages++;
      thisMonthByDaySets[new Date(created).getDate() - 1]!.add(convId);
      if (created >= weekStartIso && created <= weekEndIso) {
        thisWeekByDaySets[new Date(created).getDay()]!.add(convId);
      }
    }
  }

  const revenueThisMonth = payMonthSnap.docs.reduce((sum, d) => {
    const p = d.data();
    const paidAt = p.paidAt as string | undefined;
    if (!paidAt || paidAt < monthStart || paidAt > monthEnd) return sum;
    return sum + Number(p.amount ?? 0);
  }, 0);

  const conversationGrowth =
    lastMonthConversations > 0
      ? Math.round(((monthConversations - lastMonthConversations) / lastMonthConversations) * 100)
      : 100;

  return {
    conversations: {
      total: convTotalSnap.data().count,
      open: convOpenSnap.data().count,
      thisMonth: monthConversations,
      growth: conversationGrowth,
      thisWeekByDay: thisWeekByDaySets.map((s) => s.size),
      thisMonthByDay: thisMonthByDaySets.map((s) => s.size),
    },
    messages: { total: totalMessages, thisMonth: monthMessages },
    appointments: {
      pending: aptPendingSnap.size,
      thisMonth: aptMonthSnap.size,
    },
    payments: {
      pending: payPendingSnap.size,
      revenueThisMonth,
    },
  };
}

export async function listTenantBusinessIds(tenantId: string): Promise<string[]> {
  const snap = await businesses().where("tenantId", "==", tenantId).get();
  return snap.docs.map((d) => d.id);
}

export async function deleteTenantFirestoreData(tenantId: string): Promise<void> {
  const db = getDb();
  const businessSnap = await businesses().where("tenantId", "==", tenantId).get();
  for (const doc of businessSnap.docs) {
    await db.recursiveDelete(doc.ref);
  }

  const feedbackCol = db.collection("tenantCancellationFeedback");
  while (true) {
    const feedbackSnap = await feedbackCol.where("tenantId", "==", tenantId).limit(400).get();
    if (feedbackSnap.empty) break;
    const batch = db.batch();
    for (const doc of feedbackSnap.docs) batch.delete(doc.ref);
    await batch.commit();
  }

  await db.recursiveDelete(tenants().doc(tenantId));
}

import axios from "axios";
import { reload } from "firebase/auth";
import {
  backendSync,
  backendUpdateProfileEmail,
  backendUpdateProfileName,
  backendUpdateProfilePassword,
} from "./backend-auth";
import { backendCreateBusiness, backendListBusinesses } from "./backend-business";
import {
  backendGetSchedule,
  backendListSchedules,
  backendPutSchedule,
} from "./backend-schedule";
import type { SchedulePayload } from "./backend-schedule";
import {
  backendDeleteWhatsAppConnection,
  backendGetWhatsAppQr,
  backendPostWhatsAppQr,
  backendSendWhatsAppMedia,
  backendSendWhatsAppMessage,
} from "./backend-chat-whatsapp";
import {
  backendCancelStory,
  backendCancelStorySeries,
  backendCreateStories,
  backendListStories,
  backendRepostStory,
} from "./backend-stories-whatsapp";
import { getBackendBaseUrl } from "./backend-url";
import type { CreateBusinessInput } from "./backend-business";
import { setToken } from "./auth";
import { getClientAuth } from "@flowdesk/firebase/client";
import {
  getClientBusiness,
  updateClientBusiness,
  listClientCatalog,
  createClientCatalogItem,
  updateClientCatalogItem,
  deleteClientCatalogItem,
  listClientFaqs,
  createClientFaq,
  updateClientFaq,
  deleteClientFaq,
  getClientTenant,
  completeClientOnboarding,
  acceptClientLgpd,
  submitClientCancellationFeedback,
  listClientConversations,
  getClientConversation,
  updateClientConversationStatus,
  deleteClientConversation,
  listClientAppointments,
  updateClientAppointment,
  listClientPayments,
  getClientAnalytics,

} from "@flowdesk/firebase/client";
import type {
  ConversationStatus,
  AppointmentStatus,
  ScheduledStatus,
} from "@flowdesk/firebase/client";

function isLocalDevHost() {
  if (typeof window === "undefined") return false;
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

export function resolveChatMediaUrl(mediaUrl: string | undefined): string | undefined {
  if (!mediaUrl?.trim()) return undefined;
  const base = getBackendBaseUrl();
  const rewrite = (pathname: string) => {
    if (pathname.startsWith("/chat-media/") || pathname.startsWith("/status-media/")) {
      return `${base}${pathname}`;
    }
    return mediaUrl;
  };
  try {
    const u = new URL(mediaUrl);
    return rewrite(u.pathname);
  } catch {
    if (mediaUrl.startsWith("/chat-media/") || mediaUrl.startsWith("/status-media/")) {
      return `${base}${mediaUrl}`;
    }
    return mediaUrl;
  }
}

function resolveApiBaseUrl() {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim();
  const onLocal = isLocalDevHost();
  if (url && !(url.includes("localhost") && !onLocal)) return url.replace(/\/$/, "");
  if (onLocal) return url || "http://localhost:3001";
  if (typeof window === "undefined") return url || "http://127.0.0.1:3001";
  throw new Error("NEXT_PUBLIC_API_URL não configurada para produção.");
}

let apiBaseUrl: string | undefined;
function getApiBaseUrl() {
  if (!apiBaseUrl) apiBaseUrl = resolveApiBaseUrl();
  return apiBaseUrl;
}

function hasPublicApi() {
  return Boolean(process.env.NEXT_PUBLIC_API_URL?.trim()) || isLocalDevHost();
}

function getStripePaymentLink(plan: "STARTER" | "PRO" | "UNLIMITED") {
  const links: Record<"STARTER" | "PRO" | "UNLIMITED", string | undefined> = {
    STARTER: process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_STARTER?.trim(),
    PRO: process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_PRO?.trim(),
    UNLIMITED: process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK_UNLIMITED?.trim(),
  };
  return links[plan] ?? "";
}

function getStripePortalLink() {
  return process.env.NEXT_PUBLIC_STRIPE_BILLING_PORTAL_URL?.trim() ?? "";
}

export const api = axios.create({
  timeout: 90_000,
});

function requireUid(): string {
  const uid = getClientAuth().currentUser?.uid;
  if (!uid) throw new Error("Faça login para continuar.");
  return uid;
}

async function ensureTenantRecord() {
  const user = getClientAuth().currentUser;
  if (!user?.email) throw new Error("E-mail não encontrado na conta.");
  await backendSync(user.displayName ?? user.email.split("@")[0] ?? "Usuário");
}

api.interceptors.request.use(async (config) => {
  if (!config.baseURL) config.baseURL = getApiBaseUrl();
  const user = getClientAuth().currentUser;
  if (!user) return config;
  const token = await user.getIdToken(false);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    setToken(token);
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config as typeof err.config & { _authRetry?: boolean };
    const status = err.response?.status;

    if (status === 404 && typeof config?.url === "string" && config.url.includes("/privacy/")) {
      err.message =
        "Função de privacidade indisponível no servidor. Atualize apps/api e faça deploy.";
      return Promise.reject(err);
    }

    if (status === 401 && config && !config._authRetry) {
      const user = getClientAuth().currentUser;
      if (user) {
        config._authRetry = true;
        try {
          const token = await user.getIdToken(true);
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
            setToken(token);
            return api(config);
          }
        } catch {
          /* refresh falhou */
        }
      }
    }

    const data = err.response?.data;
    const apiMsg =
      typeof data?.error === "string"
        ? data.error
        : typeof data?.message === "string"
          ? data.message
          : null;
    const apiUrl = resolveApiBaseUrl();
    if (apiMsg) {
      err.message = apiMsg;
    } else if (status && status >= 502 && status <= 504) {
      err.message = `API temporariamente indisponível (${apiUrl}). Aguarde ~30s e tente de novo.`;
    } else if (!err.response) {
      const isLocal = isLocalDevHost();
      if (isLocal) {
        err.message = "API offline. Inicie com pnpm dev (porta 3001).";
      } else if (err.code === "ECONNABORTED") {
        err.message = "API demorou para responder (servidor iniciando). Aguarde 30s e tente de novo.";
      } else {
        const pageOrigin =
          typeof window !== "undefined" ? window.location.origin : "";
        const corsHint =
          pageOrigin && apiUrl && !apiUrl.startsWith(pageOrigin)
            ? ` Se o painel está em ${pageOrigin}, inclua essa URL em CORS_ORIGIN na API (VM) e reinicie o container.`
            : "";
        err.message = `Não foi possível conectar à API (${apiUrl}). Verifique se a VM está no ar, HTTPS na URL da API e CORS.${corsHint}`;
      }
    } else if (status === 401) {
      err.message = "Sessão inválida. Entre de novo.";
    } else if (status === 500 && err.message === "Request failed with status code 500") {
      err.message = "Erro no servidor ao processar cobrança. Tente novamente.";
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  sync: async (name?: string) => {
    const user = getClientAuth().currentUser;
    if (!user?.email) return null;
    return backendSync(
      name ?? user.displayName ?? user.email.split("@")[0] ?? "Usuário",
    );
  },
};

export const tenantApi = {
  get: () => getClientTenant(requireUid()),
  completeOnboarding: async () => {
    await ensureTenantRecord();
    return completeClientOnboarding(requireUid());
  },
  acceptLgpd: async (policyVersion: string) => {
    await ensureTenantRecord();
    return acceptClientLgpd(requireUid(), policyVersion);
  },
  submitCancellationFeedback: async (data: { rating: number; text?: string }) => {
    await ensureTenantRecord();
    return submitClientCancellationFeedback(requireUid(), data);
  },
};

async function reloadAuthUser() {
  const user = getClientAuth().currentUser;
  if (user) await reload(user);
}

export const profileApi = {
  updateName: async (name: string) => {
    const result = await backendUpdateProfileName(name);
    await reloadAuthUser();
    return result;
  },
  updateEmail: async (email: string, password: string) => {
    const result = await backendUpdateProfileEmail(email, password);
    await reloadAuthUser();
    return result;
  },
  updatePassword: (current: string, next: string) =>
    backendUpdateProfilePassword(current, next),
};

export const businessApi = {
  list: () => backendListBusinesses(),
  get: (id: string) => getClientBusiness(id, requireUid()),
  create: async (data: CreateBusinessInput) => {
    const existing = await backendListBusinesses();
    if (existing.length > 0) throw new Error("Sua conta já possui um negócio cadastrado.");
    return backendCreateBusiness(data);
  },
  update: (id: string, data: Parameters<typeof updateClientBusiness>[2]) =>
    updateClientBusiness(id, requireUid(), data),
  setConnected: (id: string, isConnected: boolean) =>
    updateClientBusiness(id, requireUid(), { isConnected }),
};

export const scheduleApi = {
  list: (businessId?: string) => backendListSchedules(businessId),
  get: (businessId: string) => backendGetSchedule(businessId),
  put: (businessId: string, data: SchedulePayload) => backendPutSchedule(businessId, data),
};

async function assertBusinessAccess(businessId: string) {
  const tenantId = requireUid();
  const biz = await getClientBusiness(businessId, tenantId);
  if (!biz) throw new Error("Negócio não encontrado ou sem acesso.");
  return biz;
}

export const catalogApi = {
  list: async (businessId: string) => {
    requireUid();
    return listClientCatalog(businessId);
  },
  create: async (businessId: string, data: Record<string, unknown>) => {
    await assertBusinessAccess(businessId);
    return createClientCatalogItem(businessId, data as Parameters<typeof createClientCatalogItem>[1]);
  },
  update: async (businessId: string, itemId: string, data: Record<string, unknown>) => {
    await assertBusinessAccess(businessId);
    return updateClientCatalogItem(businessId, itemId, data);
  },
  remove: async (businessId: string, itemId: string) => {
    await assertBusinessAccess(businessId);
    return deleteClientCatalogItem(businessId, itemId);
  },
};

export const faqApi = {
  list: (businessId: string) => listClientFaqs(businessId),
  create: (businessId: string, data: Record<string, unknown>) =>
    createClientFaq(businessId, data as Parameters<typeof createClientFaq>[1]),
  update: (businessId: string, faqId: string, data: Record<string, unknown>) =>
    updateClientFaq(businessId, faqId, data as Parameters<typeof updateClientFaq>[2]),
  remove: (businessId: string, faqId: string) => deleteClientFaq(businessId, faqId),
};

export const conversationApi = {
  list: (businessId: string, params?: { status?: string; page?: number }) =>
    listClientConversations(businessId, requireUid(), {
      status: params?.status as ConversationStatus | undefined,
      page: params?.page,
    }),
  get: (businessId: string, conversationId: string) =>
    getClientConversation(businessId, requireUid(), conversationId),
  attend: (businessId: string, conversationId: string) =>
    updateClientConversationStatus(businessId, requireUid(), conversationId, "ATTENDING"),
  release: (businessId: string, conversationId: string) =>
    updateClientConversationStatus(businessId, requireUid(), conversationId, "OPEN"),
  close: (businessId: string, conversationId: string) =>
    updateClientConversationStatus(businessId, requireUid(), conversationId, "CLOSED"),
  remove: (businessId: string, conversationId: string) =>
    deleteClientConversation(businessId, requireUid(), conversationId),
};

export const scheduledStatusApi = {
  list: (businessId: string) => backendListStories(businessId),
  create: (
    businessId: string,
    data: {
      file: File;
      caption?: string;
      scheduledDays: string[];
      hour: number;
      minute: number;
      publishNow?: boolean;
    }
  ) => backendCreateStories(businessId, data),
  repost: (
    businessId: string,
    statusId: string,
    data: { scheduledDays: string[]; hour: number; minute: number; publishNow?: boolean }
  ) => backendRepostStory(businessId, statusId, data),
  cancel: (businessId: string, statusId: string) => backendCancelStory(businessId, statusId),
  cancelSeries: (businessId: string, seriesId: string) =>
    backendCancelStorySeries(businessId, seriesId),
};

export type { ScheduledStatus };

export const whatsappApi = {
  connect: (businessId: string, force = false) => backendPostWhatsAppQr(businessId, force),
  status: (businessId: string) => backendGetWhatsAppQr(businessId),
  disconnect: (businessId: string) => backendDeleteWhatsAppConnection(businessId),
  send: (businessId: string, to: string, text: string, conversationId?: string) =>
    backendSendWhatsAppMessage(businessId, { to, text, conversationId }),
  sendMedia: (businessId: string, conversationId: string, file: File, caption?: string) =>
    backendSendWhatsAppMedia(businessId, conversationId, file, caption),
};

export const appointmentApi = {
  list: (businessId: string, params?: { from?: string; to?: string; status?: string }) =>
    listClientAppointments(businessId, requireUid(), {
      from: params?.from,
      to: params?.to,
      status: params?.status as AppointmentStatus | undefined,
    }),
  patch: (businessId: string, appointmentId: string, data: Record<string, unknown>) =>
    updateClientAppointment(businessId, requireUid(), appointmentId, data as Parameters<typeof updateClientAppointment>[3]),
};

export const billingApi = {
  checkout: async (plan: "STARTER" | "PRO" | "UNLIMITED") => {
    const directLink = getStripePaymentLink(plan);
    if (directLink) {
      return { url: directLink };
    }
    if (!hasPublicApi()) {
      throw new Error(`Link Stripe do plano ${plan} não configurado.`);
    }
    await authApi.sync();
    return api.post("/billing/checkout", { plan }).then((r) => r.data as { url?: string });
  },
  portal: async () => {
    const portalLink = getStripePortalLink();
    if (portalLink) {
      return { url: portalLink };
    }
    if (!hasPublicApi()) {
      throw new Error("Portal Stripe não configurado.");
    }
    await authApi.sync();
    return api.post("/billing/portal").then((r) => r.data as { url?: string });
  },
  sync: async () => {
    if (!hasPublicApi()) {
      return { ok: false as const, planStatus: null, subscriptionStatus: null };
    }
    await authApi.sync();
    return api.post("/billing/sync").then(
      (r) =>
        r.data as {
          ok: boolean;
          plan?: string;
          planStatus?: string;
          stripeCustomerId?: string | null;
          stripeSubscriptionId?: string | null;
          subscriptionStatus?: string | null;
          cancelAtPeriodEnd?: boolean;
          currentPeriodEnd?: string | null;
          canceledAt?: string | null;
        }
    );
  },
};

const emptyAnalytics = {
  conversations: { thisMonth: 0, growth: 0 },
  appointments: { pending: 0 },
  payments: { revenueThisMonth: 0 },
};

export const analyticsApi = {
  get: (businessId: string) =>
    getClientAnalytics(businessId, requireUid()).catch(() => emptyAnalytics),
};

export const paymentApi = {
  list: (businessId: string) => listClientPayments(businessId, requireUid()),
};

export const asaasApi = {
  get: (businessId: string) =>
    api.get(`/businesses/${businessId}/integrations/asaas`).then((r) => r.data),
  save: (
    businessId: string,
    data: { apiKey?: string; sandbox?: boolean; webhookToken?: string }
  ) => api.put(`/businesses/${businessId}/integrations/asaas`, data).then((r) => r.data),
  remove: (businessId: string) =>
    api.delete(`/businesses/${businessId}/integrations/asaas`),
};

export const privacyApi = {
  exportMyData: () => api.get("/privacy/export").then((r) => r.data),
  request: (type: "CORRECTION" | "OPPOSITION" | "REVOCATION" | "ERASURE", details?: string) =>
    api.post("/privacy/requests", { type, details }).then((r) => r.data),
  anonymizeMyData: () => api.post("/privacy/anonymize").then((r) => r.data),
  deleteAccount: () => api.post("/privacy/delete-account").then((r) => r.data),
};

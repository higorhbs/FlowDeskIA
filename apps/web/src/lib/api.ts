import axios from "axios";
import { reload } from "firebase/auth";
import {
  backendUpdateProfileEmail,
  backendUpdateProfileName,
  backendUpdateProfilePassword,
} from "./backend-auth";
import {
  backendDeleteWhatsAppConnection,
  backendGetWhatsAppQr,
  backendPostWhatsAppQr,
  backendSendAppointmentConfirmation,
  backendSendWhatsAppMedia,
  backendSendWhatsAppMessage,
  backendSendWhatsAppReport,
  backendTestPrinter,
} from "./backend-chat-whatsapp";
import {
  backendCancelStory,
  backendCancelStorySeries,
  backendCreateStories,
  backendListStories,
  backendRepostStory,
  type ScheduledStatus,
} from "./backend-stories-whatsapp";
import { getBackendBaseUrl, getClientBackendBaseUrl } from "./backend-url";
import { setToken } from "./auth";
import { getClientAuth } from "@flowdesk/firebase/client";
import { webApi } from "./web-api";
import type {
  ConversationStatus,
  AppointmentStatus,
  OrderStatus,
  Tenant,
  Business,
} from "@flowdesk/firebase/client";
import type { CreateBusinessInput } from "./web-api/businesses";
import type { SchedulePayload } from "./web-api/schedules";

export type { CreateBusinessInput, SchedulePayload, ScheduledStatus };

function isLocalDevHost() {
  if (typeof window === "undefined") return false;
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

export function resolveChatMediaUrl(mediaUrl: string | undefined): string | undefined {
  return mediaUrl?.trim() || undefined;
}

function resolveApiBaseUrl() {
  if (typeof window !== "undefined") return getClientBackendBaseUrl();
  const url = process.env.NEXT_PUBLIC_API_URL?.trim();
  const onLocal = isLocalDevHost();
  if (url && !(url.includes("localhost") && !onLocal)) return url.replace(/\/$/, "");
  try {
    return getBackendBaseUrl();
  } catch {
    if (onLocal) return url || "http://localhost:3001";
    return url || "http://127.0.0.1:3001";
  }
}

let apiBaseUrl: string | undefined;
function getApiBaseUrl() {
  if (!apiBaseUrl) apiBaseUrl = resolveApiBaseUrl();
  return apiBaseUrl;
}

function hasPublicApi() {
  if (isLocalDevHost()) return true;
  if (process.env.NEXT_PUBLIC_API_URL?.trim()) return true;
  try {
    getBackendBaseUrl();
    return true;
  } catch {
    return false;
  }
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
  withCredentials: true,
});

async function ensureTenantRecord(name?: string) {
  const user = getClientAuth().currentUser;
  if (!user?.email) throw new Error("E-mail não encontrado na conta.");
  await webApi.tenants.syncTenant(
    name ?? user.displayName ?? user.email.split("@")[0] ?? "Usuário",
  );
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
        "Função de privacidade indisponível no servidor. Atualize o backend e faça deploy.";
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
    return webApi.tenants.syncTenant(
      name ?? user.displayName ?? user.email.split("@")[0] ?? "Usuário",
    );
  },
};

export const tenantApi = {
  get: () => webApi.tenants.getTenant(),
  completeOnboarding: async () => {
    await ensureTenantRecord();
    return webApi.tenants.completeOnboarding();
  },
  acceptLgpd: async (policyVersion: string) => {
    await ensureTenantRecord();
    return webApi.tenants.acceptLgpd(policyVersion);
  },
  submitCancellationFeedback: async (data: { rating: number; text?: string }) => {
    await ensureTenantRecord();
    return webApi.tenants.submitCancellationFeedback(data);
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
  list: () => webApi.businesses.listBusinesses(),
  get: (id: string) => webApi.businesses.getBusiness(id),
  create: (data: CreateBusinessInput) => webApi.businesses.createBusiness(data),
  update: (id: string, data: Partial<Business>) =>
    webApi.businesses.updateBusiness(id, data),
  setConnected: (id: string, isConnected: boolean) =>
    webApi.businesses.updateBusiness(id, { isConnected }),
};

export const scheduleApi = {
  list: (businessId?: string) => webApi.schedules.listSchedules(businessId),
  get: (businessId: string) => webApi.schedules.getSchedule(businessId),
  put: (businessId: string, data: SchedulePayload) =>
    webApi.schedules.putSchedule(businessId, data),
};

export const catalogApi = {
  list: (businessId: string) => webApi.catalog.listCatalog(businessId),
  create: (businessId: string, data: Record<string, unknown>) =>
    webApi.catalog.createCatalogItem(
      businessId,
      data as Parameters<typeof webApi.catalog.createCatalogItem>[1],
    ),
  update: (businessId: string, itemId: string, data: Record<string, unknown>) =>
    webApi.catalog.updateCatalogItem(
      businessId,
      itemId,
      data as Parameters<typeof webApi.catalog.updateCatalogItem>[2],
    ),
  remove: (businessId: string, itemId: string) =>
    webApi.catalog.deleteCatalogItem(businessId, itemId),
};

export const faqApi = {
  list: (businessId: string) => webApi.faqs.listFaqs(businessId),
  create: (businessId: string, data: Record<string, unknown>) =>
    webApi.faqs.createFaq(
      businessId,
      data as Parameters<typeof webApi.faqs.createFaq>[1],
    ),
  update: (businessId: string, faqId: string, data: Record<string, unknown>) =>
    webApi.faqs.updateFaq(
      businessId,
      faqId,
      data as Parameters<typeof webApi.faqs.updateFaq>[2],
    ),
  remove: (businessId: string, faqId: string) => webApi.faqs.deleteFaq(businessId, faqId),
};

export const conversationApi = {
  list: (businessId: string, params?: { status?: string; page?: number }) =>
    webApi.conversations.listConversations(businessId, {
      status: params?.status as ConversationStatus | undefined,
      page: params?.page,
    }),
  get: (businessId: string, conversationId: string) =>
    webApi.conversations.getConversation(businessId, conversationId),
  create: (businessId: string, phone: string) =>
    webApi.conversations.createConversation(businessId, phone),
  attend: (businessId: string, conversationId: string) =>
    webApi.conversations.updateConversationStatus(businessId, conversationId, "ATTENDING"),
  release: (businessId: string, conversationId: string) =>
    webApi.conversations.updateConversationStatus(businessId, conversationId, "OPEN"),
  close: (businessId: string, conversationId: string) =>
    webApi.conversations.updateConversationStatus(businessId, conversationId, "CLOSED"),
  remove: (businessId: string, conversationId: string) =>
    webApi.conversations.deleteConversation(businessId, conversationId),
};

export const whatsappApi = {
  connect: (businessId: string, force = false) => backendPostWhatsAppQr(businessId, force),
  status: (businessId: string) => backendGetWhatsAppQr(businessId),
  disconnect: (businessId: string) => backendDeleteWhatsAppConnection(businessId),
  send: (businessId: string, to: string, text: string, conversationId: string) =>
    backendSendWhatsAppMessage(businessId, { to, text, conversationId }),
  sendMedia: (businessId: string, conversationId: string, file: File, caption?: string) =>
    backendSendWhatsAppMedia(businessId, conversationId, file, caption),
  sendReport: (businessId: string, period: "day" | "week" | "month") =>
    backendSendWhatsAppReport(businessId, period),
  sendAppointmentConfirmation: (businessId: string, appointmentId: string) =>
    backendSendAppointmentConfirmation(businessId, appointmentId),
  testPrinter: (businessId: string) => backendTestPrinter(businessId),
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

const emptyAnalytics = {
  conversations: { thisMonth: 0, growth: 0 },
  appointments: { pending: 0 },
  payments: { revenueThisMonth: 0 },
};

export const appointmentApi = {
  list: (businessId: string, params?: { from?: string; to?: string; status?: string }) =>
    webApi.appointments.listAppointments(businessId, {
      from: params?.from,
      to: params?.to,
      status: params?.status as AppointmentStatus | undefined,
    }),
  create: (businessId: string, data: Parameters<typeof webApi.appointments.createAppointment>[1]) =>
    webApi.appointments.createAppointment(businessId, data),
  patch: (businessId: string, appointmentId: string, data: Record<string, unknown>) =>
    webApi.appointments.updateAppointment(
      businessId,
      appointmentId,
      data as Parameters<typeof webApi.appointments.updateAppointment>[2],
    ),
};

export const orderApi = {
  list: (businessId: string, params?: { from?: string; to?: string; status?: string }) =>
    webApi.orders.listOrders(businessId, {
      from: params?.from,
      to: params?.to,
      status: params?.status as OrderStatus | undefined,
    }),
  patch: (businessId: string, orderId: string, data: Record<string, unknown>) =>
    webApi.orders.updateOrder(
      businessId,
      orderId,
      data as Parameters<typeof webApi.orders.updateOrder>[2],
    ),
};

function billingApiBase() {
  if (typeof window === "undefined") return undefined;
  return window.location.origin;
}

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
    return api
      .post("/api/billing/checkout", { plan }, { baseURL: billingApiBase() })
      .then((r) => r.data as { url?: string });
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
    return api
      .post("/api/billing/portal", undefined, { baseURL: billingApiBase() })
      .then((r) => r.data as { url?: string });
  },
  sync: async () => {
    if (!hasPublicApi()) {
      return { ok: false as const, planStatus: null, subscriptionStatus: null };
    }
    await authApi.sync();
    return api
      .post("/api/billing/sync", undefined, { baseURL: billingApiBase() })
      .then(
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

export const analyticsApi = {
  get: (businessId: string) =>
    webApi.analytics.getAnalytics(businessId).catch(() => emptyAnalytics),
};

export const paymentApi = {
  list: (businessId: string) => webApi.payments.listPayments(businessId),
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
  deleteAccount: () => api.post("/privacy/delete-account").then((r) => r.data),
};

export type { Tenant };

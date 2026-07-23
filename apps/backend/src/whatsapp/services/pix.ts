import axios from "axios";
import {
  getBusinessMercadoPagoIntegration,
  setBusinessMercadoPagoIntegration,
} from "@flowdesk/firebase";
import { optionalEnv } from "../env.js";

const MP_API = "https://api.mercadopago.com";
const REFRESH_SKEW_MS = 5 * 60 * 1000;

export interface PixChargeInput {
  businessId: string;
  paymentId: string;
  customerName: string;
  customerPhone: string;
  description: string;
  amount: number;
  externalRef?: string;
}

export interface PixChargeResult {
  mpPaymentId: string;
  pixQrCode: string;
  pixCopyPaste: string;
  amount: number;
  status: string;
}

function normalizeBrPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return digits;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    return digits.slice(2);
  }
  return digits;
}

function payerEmailFromPhone(phone: string): string {
  const digits = normalizeBrPhone(phone) || "cliente";
  return `${digits}@pix.flowdesk.local`;
}

function publicWebhookUrl(): string {
  const envBase =
    optionalEnv("API_PUBLIC_URL") ||
    optionalEnv("WA_API_PUBLIC_URL") ||
    optionalEnv("NEXT_PUBLIC_API_URL");
  if (envBase && !/localhost|127\.0\.0\.1/.test(envBase)) {
    return `${envBase.replace(/\/$/, "")}/webhooks/mercadopago`;
  }
  return "https://api.flowdesk.app/webhooks/mercadopago";
}

async function refreshAccessToken(refreshToken: string) {
  const clientId = optionalEnv("MP_CLIENT_ID");
  const clientSecret = optionalEnv("MP_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("MP_CLIENT_ID/MP_CLIENT_SECRET não configurados");
  }
  const { data } = await axios.post(
    `${MP_API}/oauth/token`,
    {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    },
    { headers: { "Content-Type": "application/json" }, timeout: 20_000 }
  );
  const expiresIn = Number(data.expires_in) || 21600;
  return {
    accessToken: String(data.access_token || ""),
    refreshToken: String(data.refresh_token || refreshToken),
    mpUserId: String(data.user_id ?? ""),
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    liveMode: data.live_mode !== false,
  };
}

async function resolveAccessToken(businessId: string): Promise<string> {
  const integration = await getBusinessMercadoPagoIntegration(businessId);
  if (!integration?.accessToken) {
    throw new Error("Conta Mercado Pago não conectada. Configure em Pagamentos no painel.");
  }
  const expiresAt = Date.parse(integration.expiresAt || "");
  const stillValid = Number.isFinite(expiresAt) && expiresAt - Date.now() > REFRESH_SKEW_MS;
  if (stillValid) return integration.accessToken;

  if (!integration.refreshToken) return integration.accessToken;

  const tokens = await refreshAccessToken(integration.refreshToken);
  const saved = await setBusinessMercadoPagoIntegration(businessId, {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    mpUserId: tokens.mpUserId || integration.mpUserId,
    expiresAt: tokens.expiresAt,
    email: integration.email,
    liveMode: tokens.liveMode,
  });
  return saved.accessToken;
}

export async function createPixCharge(input: PixChargeInput): Promise<PixChargeResult> {
  const accessToken = await resolveAccessToken(input.businessId);
  const externalReference =
    input.externalRef?.trim() || `${input.businessId}:${input.paymentId}`;

  const { data } = await axios.post(
    `${MP_API}/v1/payments`,
    {
      transaction_amount: Number(input.amount),
      description: input.description,
      payment_method_id: "pix",
      payer: { email: payerEmailFromPhone(input.customerPhone) },
      external_reference: externalReference,
      notification_url: publicWebhookUrl(),
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `${input.businessId}-${input.paymentId}`,
      },
      timeout: 25_000,
    }
  );

  const tx = data?.point_of_interaction?.transaction_data || {};
  const pixCopyPaste = String(tx.qr_code || "");
  const pixQrCode = String(tx.qr_code_base64 || "");
  if (!pixCopyPaste) {
    throw new Error("Mercado Pago não retornou código PIX. Verifique se a conta tem PIX ativo.");
  }

  return {
    mpPaymentId: String(data.id),
    pixQrCode,
    pixCopyPaste,
    amount: input.amount,
    status: String(data.status || ""),
  };
}

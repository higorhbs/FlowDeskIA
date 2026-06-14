import { getClientAuth } from "@flowdesk/firebase/client";
import { getAuthApiBaseUrl } from "./backend-url";

export async function getAuthBearer(): Promise<string> {
  const user = getClientAuth().currentUser;
  if (!user) throw new Error("Faça login para continuar.");
  const token = await user.getIdToken();
  if (!token) throw new Error("Sessão inválida. Entre de novo.");
  return token;
}

export async function authFetch(
  path: string,
  init: RequestInit & { timeoutMs?: number; baseUrl?: string } = {},
) {
  const { timeoutMs, baseUrl, ...rest } = init;
  const token = await getAuthBearer();
  const headers = new Headers(rest.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (rest.body && !headers.has("Content-Type") && !(rest.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const controller = timeoutMs ? new AbortController() : undefined;
  const timer =
    controller && timeoutMs
      ? setTimeout(() => controller.abort(), timeoutMs)
      : undefined;
  const res = await fetch(`${baseUrl ?? getAuthApiBaseUrl()}${path}`, {
    ...rest,
    headers,
    credentials: "include",
    signal: controller?.signal ?? rest.signal,
  });
  if (timer) clearTimeout(timer);
  const data = await parseJson(res);
  if (!res.ok) fail(data, res.status);
  return data;
}

type VerifiedPayload = {
  status: "VERIFIED";
  customToken: string;
  uid: string;
};

type PendingPayload = {
  status: "VERIFICATION_REQUIRED";
  email: string;
};

type ErrorPayload = {
  error?: string;
  code?: string;
};

type AuthJson = VerifiedPayload | PendingPayload | ErrorPayload;

async function parseJson(res: Response): Promise<AuthJson> {
  return (await res.json().catch(() => ({}))) as AuthJson;
}

function fail(data: AuthJson, status: number): never {
  let message =
    "error" in data && data.error ? data.error : proxyStatusMessage(status);
  const err = new Error(message);
  if ("code" in data && data.code) (err as { code?: string }).code = data.code;
  throw err;
}

function proxyStatusMessage(status: number): string {
  if (status === 530) {
    return "Servidor WhatsApp inacessível (530). Backend offline ou BACKEND_INTERNAL_URL errado na Vercel.";
  }
  if (status === 502 || status === 503) {
    return "Servidor WhatsApp indisponível. Tente de novo em instantes.";
  }
  if (status === 504) return "Tempo esgotado ao contactar o servidor WhatsApp.";
  return `Erro ${status}`;
}

function readVerifiedPayload(data: AuthJson, status: number): VerifiedPayload {
  if (!("status" in data) || data.status !== "VERIFIED") {
    fail(
      {
        error:
          "Resposta de login inválida (sem customToken). Confira FIREBASE_PRIVATE_KEY no backend e redeploy.",
      },
      status,
    );
  }
  const payload = data as VerifiedPayload & { token?: string };
  const customToken = payload.customToken?.trim() || payload.token?.trim() || "";
  if (!customToken) {
    const keys = Object.keys(data as object).join(", ") || "(vazio)";
    throw new Error(
      `Backend retornou login sem customToken (campos: ${keys}). Confira rede: login deve ir direto para NEXT_PUBLIC_BACKEND_URL, não proxy Vercel.`,
    );
  }
  return { status: "VERIFIED", customToken, uid: payload.uid };
}

export async function backendRegister(name: string, email: string, password: string) {
  const res = await fetch(`${getAuthApiBaseUrl()}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, email, password }),
  });
  const data = await parseJson(res);
  if (!res.ok) fail(data, res.status);
  return data as PendingPayload;
}

export async function backendLogin(email: string, password: string) {
  const res = await fetch(`${getAuthApiBaseUrl()}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJson(res);
  if (res.status === 403 && "status" in data && data.status === "VERIFICATION_REQUIRED") {
    return data;
  }
  if (!res.ok) fail(data, res.status);
  return readVerifiedPayload(data, res.status);
}

export async function backendGoogle(accessToken: string) {
  const res = await fetch(`${getAuthApiBaseUrl()}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ accessToken }),
  });
  const data = await parseJson(res);
  if (!res.ok) fail(data, res.status);
  return readVerifiedPayload(data, res.status);
}

export async function backendResendVerification(email: string, password: string) {
  const res = await fetch(`${getAuthApiBaseUrl()}/auth/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJson(res);
  if (!res.ok) fail(data, res.status);
}

export async function backendConfirmVerification(email: string, password: string) {
  const res = await fetch(`${getAuthApiBaseUrl()}/auth/confirm-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJson(res);
  if (!res.ok) fail(data, res.status);
  return readVerifiedPayload(data, res.status);
}

export async function backendResendVerificationSession(idToken: string) {
  const res = await fetch(`${getAuthApiBaseUrl()}/auth/resend-verification/session`, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
    credentials: "include",
  });
  const data = await parseJson(res);
  if (!res.ok) fail(data, res.status);
}

export async function backendConfirmVerificationSession(idToken: string) {
  const res = await fetch(`${getAuthApiBaseUrl()}/auth/confirm-verification/session`, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
    credentials: "include",
  });
  const data = await parseJson(res);
  if (!res.ok) fail(data, res.status);
  return readVerifiedPayload(data, res.status);
}

export async function backendUpdateProfileName(name: string) {
  return authFetch("/auth/profile/name", {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export async function backendUpdateProfileEmail(email: string, currentPassword: string) {
  return authFetch("/auth/profile/email", {
    method: "PATCH",
    body: JSON.stringify({ email, currentPassword }),
  });
}

export async function backendUpdateProfilePassword(
  currentPassword: string,
  newPassword: string,
) {
  return authFetch("/auth/profile/password", {
    method: "PATCH",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

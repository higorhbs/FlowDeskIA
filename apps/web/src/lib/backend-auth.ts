import { getClientAuth } from "@flowdesk/firebase/client";
import { getBackendBaseUrl } from "./backend-url";

export async function getAuthBearer(): Promise<string> {
  const user = getClientAuth().currentUser;
  if (!user) throw new Error("Faça login para continuar.");
  const token = await user.getIdToken();
  if (!token) throw new Error("Sessão inválida. Entre de novo.");
  return token;
}

export async function authFetch(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
) {
  const { timeoutMs, ...rest } = init;
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
  const res = await fetch(`${getBackendBaseUrl()}${path}`, {
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

async function parseJson(res: Response) {
  return (await res.json().catch(() => ({}))) as VerifiedPayload & PendingPayload & ErrorPayload;
}

function fail(data: ErrorPayload, status: number) {
  const err = new Error(data.error ?? `Erro ${status}`);
  if (data.code) (err as { code?: string }).code = data.code;
  throw err;
}

export async function backendRegister(name: string, email: string, password: string) {
  const res = await fetch(`${getBackendBaseUrl()}/register`, {
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
  const res = await fetch(`${getBackendBaseUrl()}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJson(res);
  if (res.status === 403 && data.status === "VERIFICATION_REQUIRED") {
    return data as PendingPayload;
  }
  if (!res.ok) fail(data, res.status);
  return data as VerifiedPayload;
}

export async function backendGoogle(accessToken: string) {
  const res = await fetch(`${getBackendBaseUrl()}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ accessToken }),
  });
  const data = await parseJson(res);
  if (!res.ok) fail(data, res.status);
  return data as VerifiedPayload;
}

export async function backendResendVerification(email: string, password: string) {
  const res = await fetch(`${getBackendBaseUrl()}/auth/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJson(res);
  if (!res.ok) fail(data, res.status);
}

export async function backendConfirmVerification(email: string, password: string) {
  const res = await fetch(`${getBackendBaseUrl()}/auth/confirm-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  const data = await parseJson(res);
  if (!res.ok) fail(data, res.status);
  return data as VerifiedPayload;
}

export async function backendResendVerificationSession(idToken: string) {
  const res = await fetch(`${getBackendBaseUrl()}/auth/resend-verification/session`, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
    credentials: "include",
  });
  const data = await parseJson(res);
  if (!res.ok) fail(data, res.status);
}

export async function backendConfirmVerificationSession(idToken: string) {
  const res = await fetch(`${getBackendBaseUrl()}/auth/confirm-verification/session`, {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
    credentials: "include",
  });
  const data = await parseJson(res);
  if (!res.ok) fail(data, res.status);
  return data as VerifiedPayload;
}

export async function backendSync(name?: string) {
  return authFetch("/auth/sync", {
    method: "POST",
    body: JSON.stringify(name ? { name } : {}),
  });
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

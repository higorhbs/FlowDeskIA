import { getClientAuth } from "@flowdesk/firebase/client";
import { getBackendBaseUrl } from "./backend-url";

function authRequestUrl(backendPath: string): string {
  if (typeof window === "undefined") return `${getBackendBaseUrl()}${backendPath}`;
  if (backendPath === "/login") return "/api/auth/login";
  if (backendPath === "/register") return "/api/auth/register";
  if (backendPath.startsWith("/auth/")) {
    return `/api/auth/${backendPath.slice("/auth/".length)}`;
  }
  return backendPath;
}

async function publicAuthFetch(backendPath: string, init: RequestInit) {
  const res = await fetch(authRequestUrl(backendPath), {
    ...init,
    credentials: "include",
  });
  const data = await parseJson(res);
  if (!res.ok) fail(data, res.status);
  return data;
}

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
  let res: Response;
  try {
    res = await fetch(`${baseUrl ?? getBackendBaseUrl()}${path}`, {
      ...rest,
      headers,
      credentials: "include",
      signal: controller?.signal ?? rest.signal,
    });
  } catch (err) {
    if (timer) clearTimeout(timer);
    const base = baseUrl ?? getBackendBaseUrl();
    const msg =
      err instanceof Error && err.name === "AbortError"
        ? "A API demorou para responder. Tente de novo."
        : `Não foi possível conectar à API (${base}). Verifique se a VM está no ar.`;
    throw new Error(msg);
  }
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

function fail(data: AuthJson, status: number) {
  const err = new Error("error" in data && data.error ? data.error : `Erro ${status}`);
  if ("code" in data && data.code) (err as { code?: string }).code = data.code;
  throw err;
}

export async function backendRegister(name: string, email: string, password: string) {
  const data = await publicAuthFetch("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  return data as PendingPayload;
}

export async function backendLogin(email: string, password: string) {
  const res = await fetch(authRequestUrl("/login"), {
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
  return data as VerifiedPayload;
}

export async function backendGoogle(accessToken: string) {
  const data = await publicAuthFetch("/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });
  return data as VerifiedPayload;
}

export async function backendResendVerification(email: string, password: string) {
  await publicAuthFetch("/auth/resend-verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function backendConfirmVerification(email: string, password: string) {
  const data = await publicAuthFetch("/auth/confirm-verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return data as VerifiedPayload;
}

export async function backendResendVerificationSession(idToken: string) {
  await publicAuthFetch("/auth/resend-verification/session", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
  });
}

export async function backendConfirmVerificationSession(idToken: string) {
  const data = await publicAuthFetch("/auth/confirm-verification/session", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
  });
  return data as VerifiedPayload;
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

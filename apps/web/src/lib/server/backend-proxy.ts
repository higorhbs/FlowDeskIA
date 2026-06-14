import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./auth";
import { ApiError } from "./api-error";

function getServerBackendBaseUrl() {
  const internal = process.env.BACKEND_INTERNAL_URL?.trim();
  if (internal) return internal.replace(/\/$/, "");
  const dedicated = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
  if (dedicated) return dedicated.replace(/\/$/, "");
  const api = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (api) return api.replace(/\/$/, "");
  return "http://127.0.0.1:3001";
}

async function getSessionToken() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) throw new ApiError("Unauthorized", 401);
  return token;
}

async function parseBackendJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof (data as { error?: string }).error === "string"
        ? (data as { error: string }).error
        : proxyStatusMessage(res.status);
    throw new ApiError(message, res.status);
  }
  return data;
}

function proxyStatusMessage(status: number): string {
  if (status === 530) {
    return "Servidor WhatsApp inacessível (530). Backend offline ou BACKEND_INTERNAL_URL errado na Vercel.";
  }
  if (status === 502 || status === 503) return "Servidor WhatsApp indisponível.";
  if (status === 504) return "Tempo esgotado ao contactar o servidor WhatsApp.";
  return `Erro ${status}`;
}

export async function proxyBackendJson(path: string, init: RequestInit = {}, timeoutMs = 35_000) {
  const token = await getSessionToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${getServerBackendBaseUrl()}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
    return parseBackendJson(res);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError("Tempo esgotado ao contactar o servidor WhatsApp.", 504);
    }
    throw new ApiError(
      err instanceof Error ? err.message : "Servidor WhatsApp indisponível.",
      502,
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function proxyBackendForm(path: string, form: FormData, timeoutMs = 120_000) {
  const token = await getSessionToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${getServerBackendBaseUrl()}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal: controller.signal,
    });
    return parseBackendJson(res);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError("Tempo esgotado ao contactar o servidor WhatsApp.", 504);
    }
    throw new ApiError(
      err instanceof Error ? err.message : "Servidor WhatsApp indisponível.",
      502,
    );
  } finally {
    clearTimeout(timer);
  }
}

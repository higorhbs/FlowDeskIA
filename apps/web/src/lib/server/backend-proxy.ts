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
        : `Erro ${res.status}`;
    throw new ApiError(message, res.status);
  }
  return data;
}

export async function proxyBackendJson(path: string, init: RequestInit = {}) {
  const token = await getSessionToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${getServerBackendBaseUrl()}${path}`, {
    ...init,
    headers,
  });
  return parseBackendJson(res);
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
  } finally {
    clearTimeout(timer);
  }
}

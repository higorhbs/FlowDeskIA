function isLocalDevHost() {
  if (typeof window === "undefined") return process.env.NODE_ENV !== "production";
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

const LOCAL_BACKEND = "http://localhost:3001";

export function resolveBackendBaseUrl() {
  if (isLocalDevHost()) {
    return LOCAL_BACKEND;
  }

  const dedicated = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
  if (dedicated) return dedicated.replace(/\/$/, "");

  const api = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (api) return api.replace(/\/$/, "");

  if (typeof window === "undefined") return "http://127.0.0.1:3001";
  throw new Error("NEXT_PUBLIC_BACKEND_URL não configurada.");
}

export function resolveWaApiBaseUrl() {
  if (isLocalDevHost()) {
    return LOCAL_BACKEND;
  }
  const wa = process.env.NEXT_PUBLIC_WA_API_URL?.trim();
  if (wa) return wa.replace(/\/$/, "");
  return resolveBackendBaseUrl();
}

let cached: string | undefined;
let waCached: string | undefined;

export function getBackendBaseUrl() {
  if (!cached) cached = resolveBackendBaseUrl();
  return cached;
}

export function getWaApiBaseUrl() {
  if (!waCached) waCached = resolveWaApiBaseUrl();
  return waCached;
}

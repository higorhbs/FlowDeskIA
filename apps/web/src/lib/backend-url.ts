function isLocalDevHost() {
  if (typeof window === "undefined") return process.env.NODE_ENV !== "production";
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

function remoteApiInDev() {
  const api =
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
  if (!api) return false;
  try {
    const host = new URL(api).hostname;
    return host !== "localhost" && host !== "127.0.0.1";
  } catch {
    return false;
  }
}

const LOCAL_BACKEND = "http://localhost:3001";

export function shouldProxyViaWeb() {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_API_VIA_PROXY === "true") return true;
  if (process.env.NEXT_PUBLIC_API_VIA_PROXY === "false") return false;
  if (isLocalDevHost()) return remoteApiInDev();
  return true;
}

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
let clientCached: string | undefined;

export function getClientBackendBaseUrl() {
  if (typeof window === "undefined") return resolveBackendBaseUrl();
  if (!clientCached) {
    clientCached = shouldProxyViaWeb()
      ? `${window.location.origin}/api/backend`
      : resolveBackendBaseUrl();
  }
  return clientCached;
}

export function getBackendBaseUrl() {
  if (typeof window !== "undefined") return getClientBackendBaseUrl();
  if (!cached) cached = resolveBackendBaseUrl();
  return cached;
}

export function getClientDirectBackendBaseUrl() {
  if (typeof window === "undefined") return resolveBackendBaseUrl();
  if (shouldProxyViaWeb()) return resolveBackendBaseUrl();
  return getClientBackendBaseUrl();
}

export function getAuthApiBaseUrl() {
  return getClientBackendBaseUrl();
}

export function getWaApiBaseUrl() {
  if (typeof window !== "undefined") {
    if (!waCached) waCached = getClientBackendBaseUrl();
    return waCached;
  }
  if (!waCached) waCached = resolveWaApiBaseUrl();
  return waCached;
}

function isLocalDevHost() {
  if (typeof window === "undefined") return false;
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

function shouldProxyAuthViaWeb() {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_AUTH_VIA_PROXY === "true") return true;
  if (process.env.NEXT_PUBLIC_AUTH_VIA_PROXY === "false") return false;
  if (isLocalDevHost()) {
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
  return false;
}

export function resolveBackendBaseUrl() {
  const onLocal = isLocalDevHost();
  const dedicated = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();

  if (onLocal) {
    return (dedicated || "http://localhost:3001").replace(/\/$/, "");
  }

  if (dedicated) return dedicated.replace(/\/$/, "");

  const api = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (api) return api.replace(/\/$/, "");

  if (typeof window === "undefined") return "http://127.0.0.1:3001";
  throw new Error("NEXT_PUBLIC_BACKEND_URL não configurada.");
}

export function resolveWaApiBaseUrl() {
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

export function getAuthApiBaseUrl() {
  if (shouldProxyAuthViaWeb()) {
    return `${window.location.origin}/api/backend`;
  }
  return getBackendBaseUrl();
}

export function getWaApiBaseUrl() {
  if (!waCached) waCached = resolveWaApiBaseUrl();
  return waCached;
}

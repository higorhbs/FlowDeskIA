function isLocalDevHost() {
  if (typeof window === "undefined") return false;
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
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

let cached: string | undefined;

export function getBackendBaseUrl() {
  if (!cached) cached = resolveBackendBaseUrl();
  return cached;
}

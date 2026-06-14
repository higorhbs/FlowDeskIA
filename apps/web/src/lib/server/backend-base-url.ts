const LOCAL_BACKEND = "http://127.0.0.1:3001";

export function getServerBackendBaseUrl() {
  if (process.env.NODE_ENV !== "production") {
    const override = process.env.BACKEND_URL?.trim();
    return (override || LOCAL_BACKEND).replace(/\/$/, "");
  }

  const dedicated = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
  if (dedicated) return dedicated.replace(/\/$/, "");
  const api = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (api) return api.replace(/\/$/, "");
  return LOCAL_BACKEND;
}

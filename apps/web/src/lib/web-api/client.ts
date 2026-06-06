export class WebApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "WebApiError";
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & {
    error?: string;
    code?: string;
  };
  if (!res.ok) {
    throw new WebApiError(
      typeof data.error === "string" ? data.error : `Erro ${res.status}`,
      res.status,
      typeof data.code === "string" ? data.code : undefined,
    );
  }
  return data;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(path, {
    ...init,
    headers,
    credentials: "include",
  });
  return parseResponse<T>(res);
}

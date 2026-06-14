import { getServerBackendBaseUrl } from "./backend-base-url";

export async function proxyPublicAuth(path: string, req: Request) {
  const headers = new Headers();
  const contentType = req.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);
  const authorization = req.headers.get("Authorization");
  if (authorization) headers.set("Authorization", authorization);

  const body =
    req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();

  let res: Response;
  try {
    res = await fetch(`${getServerBackendBaseUrl()}${path}`, {
      method: req.method,
      headers,
      body: body || undefined,
    });
  } catch {
    return Response.json(
      { error: "API de autenticação inacessível. Tente novamente em instantes." },
      { status: 503 },
    );
  }

  const payload = await res.text();
  return new Response(payload, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/json",
    },
  });
}

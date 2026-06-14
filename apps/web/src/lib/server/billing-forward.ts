import { NextRequest, NextResponse } from "next/server";

function resolveBackend() {
  const internal = process.env.BACKEND_INTERNAL_URL?.trim();
  if (internal) return internal.replace(/\/$/, "");
  const dedicated = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
  if (dedicated) return dedicated.replace(/\/$/, "");
  const api = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (api) return api.replace(/\/$/, "");
  return "http://127.0.0.1:3001";
}

export async function forwardBilling(req: NextRequest, path: string) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await req.text() : undefined;
  const origin =
    req.headers.get("origin")?.trim() ||
    process.env.NEXT_PUBLIC_LEGAL_WEBSITE?.trim() ||
    "https://flowdesk.ia.br";

  try {
    const res = await fetch(`${resolveBackend()}${path}`, {
      method: req.method,
      headers: {
        Authorization: auth,
        "Content-Type": req.headers.get("content-type") || "application/json",
        Origin: origin,
      },
      body: body || undefined,
      cache: "no-store",
    });

    const text = await res.text();
    let payload: Record<string, unknown> = {};
    if (text) {
      try {
        payload = JSON.parse(text) as Record<string, unknown>;
      } catch {
        payload = { error: text.slice(0, 500) || `Erro ${res.status}` };
      }
    } else if (!res.ok) {
      payload = { error: `Erro ${res.status} no servidor de cobrança.` };
    }

    return NextResponse.json(payload, { status: res.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Backend indisponível";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

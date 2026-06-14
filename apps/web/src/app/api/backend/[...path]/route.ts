import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "content-encoding",
]);

export const dynamic = "force-dynamic";

function resolveServerBackendUrl() {
  const internal = process.env.BACKEND_INTERNAL_URL?.trim();
  if (internal) return internal.replace(/\/$/, "");
  const dedicated = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
  if (dedicated) return dedicated.replace(/\/$/, "");
  const api = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (api) return api.replace(/\/$/, "");
  return "http://127.0.0.1:3001";
}

function forwardHeaders(req: NextRequest, backendUrl: URL) {
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) return;
    if (lower === "host") return;
    headers.set(key, value);
  });
  headers.set("host", backendUrl.host);
  return headers;
}

function responseHeaders(res: Response) {
  const headers = new Headers();
  res.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    headers.set(key, value);
  });
  return headers;
}

async function proxy(req: NextRequest, path: string[]) {
  const suffix = path.join("/");
  const url = new URL(`/${suffix}`, `${resolveServerBackendUrl()}/`);
  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await req.arrayBuffer() : undefined;

  try {
    const res = await fetch(url, {
      method,
      headers: forwardHeaders(req, url),
      body: body?.byteLength ? body : undefined,
      cache: "no-store",
    });

    const bodyBytes = await res.arrayBuffer();
    if (!res.ok && (res.status === 530 || res.status === 502 || res.status === 503)) {
      const hint =
        res.status === 530
          ? "Servidor WhatsApp inacessível (530). Backend offline ou BACKEND_INTERNAL_URL errado na Vercel."
          : "Servidor WhatsApp indisponível.";
      return NextResponse.json({ error: hint }, { status: res.status });
    }
    return new NextResponse(bodyBytes, {
      status: res.status,
      headers: responseHeaders(res),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Backend indisponível";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

type RouteCtx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, (await ctx.params).path);
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, (await ctx.params).path);
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, (await ctx.params).path);
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, (await ctx.params).path);
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  return proxy(req, (await ctx.params).path);
}

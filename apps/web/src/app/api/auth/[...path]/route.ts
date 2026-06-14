import { proxyPublicAuth } from "@/lib/server/auth-backend-proxy";

const BACKEND_PATHS: Record<string, string> = {
  google: "/auth/google",
  login: "/login",
  register: "/register",
  "resend-verification": "/auth/resend-verification",
  "confirm-verification": "/auth/confirm-verification",
  "resend-verification/session": "/auth/resend-verification/session",
  "confirm-verification/session": "/auth/confirm-verification/session",
};

type RouteParams = { params: Promise<{ path: string[] }> };

async function handle(req: Request, ctx: RouteParams) {
  const { path } = await ctx.params;
  const key = path.join("/");
  const backendPath = BACKEND_PATHS[key];
  if (!backendPath) {
    return Response.json({ error: "Rota não encontrada." }, { status: 404 });
  }
  return proxyPublicAuth(backendPath, req);
}

export async function POST(req: Request, ctx: RouteParams) {
  return handle(req, ctx);
}

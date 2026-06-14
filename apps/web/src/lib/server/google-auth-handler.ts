import {
  createTenant,
  getAdminAuth,
  getTenant,
  hasAdminCredential,
} from "@flowdesk/firebase";
import { signInWithGoogleAccessToken } from "./firebase-identity";

function firebaseWebApiKey() {
  return (
    process.env.FIREBASE_WEB_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ||
    ""
  );
}

function requestUri(req: Request) {
  const origin = req.headers.get("Origin")?.trim();
  if (origin?.startsWith("http")) return origin;
  const web = process.env.WEB_ORIGIN?.trim() || process.env.NEXT_PUBLIC_LEGAL_WEBSITE?.trim();
  if (web?.startsWith("http")) return web;
  return "https://flowdesk.ia.br";
}

async function ensureServerTenant(uid: string, profile: { name: string; email: string }) {
  const existing = await getTenant(uid);
  if (existing) return existing;
  const displayName = profile.name.trim() || profile.email.split("@")[0] || "Usuário";
  return createTenant(uid, { name: displayName, email: profile.email });
}

export async function handleGoogleAuth(req: Request): Promise<Response> {
  const apiKey = firebaseWebApiKey();
  if (!apiKey) {
    return Response.json(
      { error: "FIREBASE_WEB_API_KEY ausente no servidor." },
      { status: 503 },
    );
  }
  if (!hasAdminCredential()) {
    return Response.json(
      { error: "Credencial Firebase Admin ausente no servidor." },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const accessToken =
    typeof body?.accessToken === "string"
      ? body.accessToken
      : typeof body?.access_token === "string"
        ? body.access_token
        : "";
  if (!accessToken) {
    return Response.json({ error: "Token do Google ausente." }, { status: 400 });
  }

  try {
    const session = await signInWithGoogleAccessToken(apiKey, accessToken, requestUri(req));
    const uid = session.localId;
    const user = await getAdminAuth().getUser(uid);
    if (user.emailVerified !== true) {
      return Response.json(
        { error: "Confirme seu e-mail antes de continuar.", code: "auth/email-not-verified" },
        { status: 403 },
      );
    }
    const email = user.email ?? session.email;
    if (!email) {
      return Response.json({ error: "E-mail não encontrado na conta Google." }, { status: 400 });
    }
    await ensureServerTenant(uid, {
      name: user.displayName ?? email.split("@")[0],
      email,
    });
    const customToken = await getAdminAuth().createCustomToken(uid);
    return Response.json({ status: "VERIFIED", customToken, uid });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao entrar com Google.";
    return Response.json({ error: message }, { status: 401 });
  }
}

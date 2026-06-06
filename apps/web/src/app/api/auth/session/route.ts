import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminAuth } from "@flowdesk/firebase";
import { SESSION_COOKIE, SESSION_MAX_AGE_SEC } from "@/lib/server/auth";

function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { idToken?: string };
  const idToken = typeof body.idToken === "string" ? body.idToken.trim() : "";
  if (!idToken) {
    return NextResponse.json({ error: "Token obrigatório." }, { status: 400 });
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    if (decoded.email_verified !== true) {
      return NextResponse.json({ error: "E-mail não verificado." }, { status: 403 });
    }
    (await cookies()).set(SESSION_COOKIE, idToken, sessionCookieOptions(SESSION_MAX_AGE_SEC));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Token inválido." }, { status: 401 });
  }
}

export async function DELETE() {
  (await cookies()).set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return NextResponse.json({ ok: true });
}

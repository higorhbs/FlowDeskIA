import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminAuth } from "@flowdesk/firebase";

export const SESSION_COOKIE = "__flowdesk_session";
export const SESSION_MAX_AGE_SEC = 60 * 60;

export type ServerSession = {
  uid: string;
  email: string | null;
};

export async function getServerSession(): Promise<ServerSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    if (decoded.email_verified !== true) return null;
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch {
    return null;
  }
}

export async function requireServerSession(): Promise<string> {
  const session = await getServerSession();
  if (!session) redirect("/?auth=login");
  return session.uid;
}

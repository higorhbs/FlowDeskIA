import { cookies } from "next/headers";
import { getAdminAuth } from "@flowdesk/firebase";
import { SESSION_COOKIE } from "./auth";
import { ApiError } from "./api-error";

export type ApiSession = {
  uid: string;
  email: string | null;
};

export async function requireApiSession(): Promise<ApiSession> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) throw new ApiError("Unauthorized", 401);

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    if (decoded.email_verified !== true) {
      throw new ApiError("E-mail não verificado.", 403, "auth/email-not-verified");
    }
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError("Unauthorized", 401);
  }
}

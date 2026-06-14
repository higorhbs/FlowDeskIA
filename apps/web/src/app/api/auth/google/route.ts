import { handleGoogleAuth } from "@/lib/server/google-auth-handler";

export async function POST(req: Request) {
  return handleGoogleAuth(req);
}

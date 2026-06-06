import type { ConversationStatus } from "@flowdesk/firebase/client";
import { requireApiSession } from "@/lib/server/api-auth";
import { apiFail, apiOk } from "@/lib/server/api-error";
import { listConversationsForUser } from "@/lib/server/services/conversations";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { uid } = await requireApiSession();
    const { id } = await params;
    const url = new URL(req.url);
    const status = url.searchParams.get("status") as ConversationStatus | null;
    const pageRaw = url.searchParams.get("page");
    const page = pageRaw ? Number(pageRaw) : undefined;
    const result = await listConversationsForUser(uid, id, {
      status: status ?? undefined,
      page: Number.isFinite(page) ? page : undefined,
    });
    return apiOk(result);
  } catch (err) {
    return apiFail(err);
  }
}

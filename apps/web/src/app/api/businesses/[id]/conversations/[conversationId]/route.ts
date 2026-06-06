import type { ConversationStatus } from "@flowdesk/firebase/client";
import { requireApiSession } from "@/lib/server/api-auth";
import { apiFail, apiOk } from "@/lib/server/api-error";
import {
  deleteConversationForUser,
  getConversationForUser,
  updateConversationStatusForUser,
} from "@/lib/server/services/conversations";

type RouteParams = { params: Promise<{ id: string; conversationId: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { uid } = await requireApiSession();
    const { id, conversationId } = await params;
    const conversation = await getConversationForUser(uid, id, conversationId);
    return apiOk(conversation);
  } catch (err) {
    return apiFail(err);
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { uid } = await requireApiSession();
    const { id, conversationId } = await params;
    const body = (await req.json().catch(() => ({}))) as { status?: ConversationStatus };
    if (!body.status) {
      return apiOk({ error: "Status obrigatório." }, 400);
    }
    const conversation = await updateConversationStatusForUser(
      uid,
      id,
      conversationId,
      body.status,
    );
    return apiOk(conversation);
  } catch (err) {
    return apiFail(err);
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  try {
    const { uid } = await requireApiSession();
    const { id, conversationId } = await params;
    await deleteConversationForUser(uid, id, conversationId);
    return apiOk({ ok: true });
  } catch (err) {
    return apiFail(err);
  }
}

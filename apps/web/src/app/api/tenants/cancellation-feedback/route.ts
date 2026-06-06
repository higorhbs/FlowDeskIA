import { requireApiSession } from "@/lib/server/api-auth";
import { apiFail, apiOk } from "@/lib/server/api-error";
import { submitCancellationFeedback } from "@/lib/server/services/tenants";

export async function POST(req: Request) {
  try {
    const { uid } = await requireApiSession();
    const body = (await req.json().catch(() => ({}))) as {
      rating?: number;
      text?: string;
    };
    const rating = typeof body.rating === "number" ? body.rating : NaN;
    const result = await submitCancellationFeedback(uid, {
      rating,
      text: typeof body.text === "string" ? body.text : undefined,
    });
    return apiOk(result);
  } catch (err) {
    return apiFail(err);
  }
}

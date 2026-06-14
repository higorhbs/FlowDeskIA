import { NextRequest } from "next/server";
import { forwardBilling } from "@/lib/server/billing-forward";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  return forwardBilling(req, "/billing/sync");
}

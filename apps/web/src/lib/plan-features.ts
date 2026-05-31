import type { Plan } from "@flowdesk/firebase/client";

export function planAllowsPix(plan?: Plan | string | null): boolean {
  return plan === "PRO" || plan === "UNLIMITED";
}

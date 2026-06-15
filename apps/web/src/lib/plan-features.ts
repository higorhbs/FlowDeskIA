import type { Plan } from "@flowdesk/firebase/client";

export function planAllowsPix(plan?: Plan | string | null): boolean {
  return plan === "PRO" || plan === "UNLIMITED";
}

export function planAllowsChatMediaStorage(plan?: Plan | string | null): boolean {
  return plan === "UNLIMITED";
}

export function planAllowsStatusVideo(plan?: Plan | string | null): boolean {
  return plan === "UNLIMITED";
}

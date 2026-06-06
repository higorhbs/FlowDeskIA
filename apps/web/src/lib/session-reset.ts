import type { QueryClient } from "@tanstack/react-query";
import { clearAuthSessionMarkers } from "./business-route";
import { removeToken } from "./auth";
import { logoutFirebase } from "./firebase-auth";
import { clearServerSession } from "./server/session-client";

export function resetClientSession(queryClient?: QueryClient) {
  clearAuthSessionMarkers();
  queryClient?.clear();
}

export async function signOutAndReset(queryClient?: QueryClient) {
  await logoutFirebase();
  await clearServerSession().catch(() => {});
  removeToken();
  resetClientSession(queryClient);
}

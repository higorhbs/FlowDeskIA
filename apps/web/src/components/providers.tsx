"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, useEffect, useState } from "react";
import { watchAuth, completeGoogleRedirect, authErrorMessage } from "@/lib/firebase-auth";
import { authApi } from "@/lib/api";
import { setToken, removeToken } from "@/lib/auth";
import { syncServerSession } from "@/lib/server/session-client";
import { readLastAuthUid, writeLastAuthUid, clearAuthSessionMarkers } from "@/lib/business-route";
import { AuthDrawerProvider } from "@/contexts/auth-drawer-context";
import { toast } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1 },
        },
      })
  );

  useEffect(() => {
    let active = true;

    completeGoogleRedirect()
      .then(async (res) => {
        if (!active || !res || res.status !== "VERIFIED") return;
        setToken(res.token);
        await syncServerSession(res.token).catch(() => {});
        window.location.replace("/dashboard");
      })
      .catch((err: unknown) => {
        if (!active) return;
        const params = new URLSearchParams(window.location.search);
        if (window.location.pathname === "/" && params.has("auth")) {
          toast.error(authErrorMessage(err, "Falha ao concluir login com Google"));
        }
      });

    const unsub = watchAuth(async (user) => {
      const nextUid = user?.emailVerified ? user.uid : null;
      const prevUid = readLastAuthUid();

      if ((prevUid && nextUid && prevUid !== nextUid) || (prevUid && !nextUid)) {
        clearAuthSessionMarkers();
        queryClient.clear();
      }

      writeLastAuthUid(nextUid);

      if (user) {
        await user.reload();
        if (!user.emailVerified) {
          removeToken();
          return;
        }
        const token = await user.getIdToken(true);
        setToken(token);
        await syncServerSession(token).catch(() => {});
        void authApi.sync().catch(() => undefined);
      } else {
        removeToken();
      }
    });

    return () => {
      active = false;
      unsub();
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>
        <AuthDrawerProvider>{children}</AuthDrawerProvider>
      </Suspense>
    </QueryClientProvider>
  );
}

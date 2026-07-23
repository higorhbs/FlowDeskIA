"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, useEffect, useRef, useState } from "react";
import { watchAuth, completeGoogleRedirect, authErrorMessage } from "@/lib/firebase-auth";
import { authApi } from "@/lib/api";
import { setToken, removeToken } from "@/lib/auth";
import { syncServerSession, clearServerSession } from "@/lib/server/session-client";
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

  const lastTokenRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    completeGoogleRedirect()
      .then(async (res) => {
        if (!active || !res || res.status !== "VERIFIED") return;
        setToken(res.token);
        lastTokenRef.current = res.token;
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
      if (!user) {
        lastTokenRef.current = null;
        const prevUid = readLastAuthUid();
        if (prevUid) {
          clearAuthSessionMarkers();
          queryClient.clear();
        }
        writeLastAuthUid(null);
        removeToken();
        void clearServerSession().catch(() => {});
        return;
      }

      const token = await user.getIdToken().catch(() => null);
      if (!token || token === lastTokenRef.current) return;
      lastTokenRef.current = token;

      try {
        await user.reload();
      } catch {
        return;
      }

      const nextUid = user.emailVerified ? user.uid : null;
      const prevUid = readLastAuthUid();
      if ((prevUid && nextUid && prevUid !== nextUid) || (prevUid && !nextUid)) {
        clearAuthSessionMarkers();
        queryClient.clear();
      }
      writeLastAuthUid(nextUid);

      if (!user.emailVerified) {
        removeToken();
        lastTokenRef.current = null;
        return;
      }
      setToken(token);
      await syncServerSession(token).catch(() => {});
      void authApi.sync().catch(() => undefined);
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

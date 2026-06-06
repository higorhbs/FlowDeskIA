"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAppRouter } from "@/lib/app-navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getClientAuth } from "@flowdesk/firebase/client";
import { authApi } from "@/lib/api";
import { AuthContext } from "@/contexts/auth-context";
import { removeToken, setToken } from "@/lib/auth";
import { syncServerSession } from "@/lib/server/session-client";

function isDashboardShellPath(path: string) {
  const base = path.split("?")[0]?.replace(/\/$/, "") ?? "";
  return (
    base === "/dashboard" ||
    base === "/profile" ||
    base === "/plan" ||
    base.startsWith("/businesses")
  );
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useAppRouter();
  const pathname = usePathname() ?? "";
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    const auth = getClientAuth();
    let unsub = () => {};

    const applyUser = (user: User | null) => {
      if (!user) {
        setUid(null);
        setReady(false);
        router.replace("/?auth=login");
        return;
      }
      void user.reload().then(async () => {
        if (!user.emailVerified) {
          removeToken();
          setUid(null);
          setReady(false);
          router.replace("/?auth=register");
          return;
        }
        const token = await user.getIdToken(true);
        setToken(token);
        await syncServerSession(token).catch(() => {});
        setUid(user.uid);
        setReady(true);
        void authApi.sync(user.displayName ?? undefined).catch(() => {});
      });
    };

    void auth.authStateReady().then(() => {
      applyUser(auth.currentUser);
      unsub = onAuthStateChanged(auth, applyUser);
    });

    return () => unsub();
  }, [router]);

  if (!ready) {
    if (isDashboardShellPath(pathname)) {
      return (
        <AuthContext.Provider value={{ ready: false, uid: null }}>
          {children}
        </AuthContext.Provider>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return <AuthContext.Provider value={{ ready, uid }}>{children}</AuthContext.Provider>;
}

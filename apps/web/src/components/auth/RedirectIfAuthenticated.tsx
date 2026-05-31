"use client";

import { useEffect } from "react";
import { useAppRouter } from "@/lib/app-navigation";
import { waitForAuthReady } from "@flowdesk/firebase/client";

export function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const router = useAppRouter();

  useEffect(() => {
    void waitForAuthReady().then((auth) => {
      const user = auth.currentUser;
      if (user?.emailVerified) router.replace("/dashboard");
    });
  }, [router]);

  return <>{children}</>;
}

"use client";

import { useEffect } from "react";
import { useAppRouter } from "@/lib/app-navigation";
import { waitForAuthReady } from "@zapflow/firebase/client";

export function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const router = useAppRouter();

  useEffect(() => {
    void waitForAuthReady().then((auth) => {
      if (auth.currentUser) router.replace("/dashboard");
    });
  }, [router]);

  return <>{children}</>;
}

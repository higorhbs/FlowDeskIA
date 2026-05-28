"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { waitForAuthReady } from "@zapflow/firebase/client";

export function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    void waitForAuthReady().then((auth) => {
      if (auth.currentUser) router.replace("/dashboard");
    });
  }, [router]);

  return <>{children}</>;
}

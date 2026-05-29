"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { hardNavigateHosting, hostingHref } from "@/lib/hosting-href";
import { isStaticHostingClient } from "@/lib/static-hosting";

type AppRouter = ReturnType<typeof useRouter>;

function useHardDocumentNav() {
  return typeof window !== "undefined" && isStaticHostingClient();
}

export function useAppRouter(): AppRouter {
  const router = useRouter();
  const hard = useHardDocumentNav();

  const push = useCallback(
    (href: string, options?: Parameters<AppRouter["push"]>[1]) => {
      if (hard) {
        hardNavigateHosting(href);
        return;
      }
      router.push(href, options);
    },
    [hard, router]
  );

  const replace = useCallback(
    (href: string, options?: Parameters<AppRouter["replace"]>[1]) => {
      if (hard) {
        window.location.replace(new URL(hostingHref(href), window.location.origin).href);
        return;
      }
      router.replace(href, options);
    },
    [hard, router]
  );

  return useMemo(() => ({ ...router, push, replace }), [router, push, replace]);
}

export function sanitizeHostingPath(pathname: string): string | null {
  if (!pathname.endsWith(".txt")) return null;
  if (pathname === "/index.txt" || pathname.endsWith("/index.txt")) {
    const base = pathname.replace(/\/index\.txt$/, "").replace(/\.txt$/, "");
    return base || "/";
  }
  const base = pathname.replace(/\.txt$/, "");
  return base || "/";
}

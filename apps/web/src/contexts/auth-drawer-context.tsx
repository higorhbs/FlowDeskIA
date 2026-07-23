"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { waitForAuthReady } from "@flowdesk/firebase/client";
import { AuthDrawer, type AuthMode } from "@/components/auth/AuthDrawer";
import { useAppRouter } from "@/lib/app-navigation";

type AuthDrawerContextValue = {
  openAuth: (mode: AuthMode) => void;
  closeAuth: () => void;
  authMode: AuthMode;
  isOpen: boolean;
};

const AuthDrawerContext = createContext<AuthDrawerContextValue | null>(null);

function parseAuthParam(value: string | null): AuthMode | null {
  if (value === "login" || value === "register") return value;
  return null;
}

function hrefWithAuth(pathname: string, search: string, mode: AuthMode | null) {
  const params = new URLSearchParams(search);
  if (mode) params.set("auth", mode);
  else params.delete("auth");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function AuthDrawerProvider({ children }: { children: React.ReactNode }) {
  const router = useAppRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [isOpen, setIsOpen] = useState(false);

  const redirectIfVerified = useCallback(async () => {
    const auth = await waitForAuthReady();
    if (auth.currentUser?.emailVerified) {
      if (pathname !== "/dashboard") router.replace("/dashboard");
      return true;
    }
    return false;
  }, [router, pathname]);

  const syncUrl = useCallback(
    (mode: AuthMode | null) => {
      const target = hrefWithAuth(pathname, search, mode);
      const current = search ? `${pathname}?${search}` : pathname;
      if (target === current) return;
      router.replace(target, { scroll: false });
    },
    [pathname, router, search],
  );

  useEffect(() => {
    const param = parseAuthParam(searchParams.get("auth"));
    if (!param) {
      setIsOpen((open) => (open ? false : open));
      return;
    }
    void redirectIfVerified().then((redirected) => {
      if (redirected) return;
      setAuthMode(param);
      setIsOpen(true);
    });
  }, [searchParams, redirectIfVerified]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const openAuth = useCallback(
    (mode: AuthMode) => {
      void redirectIfVerified().then((redirected) => {
        if (redirected) return;
        setAuthMode(mode);
        setIsOpen(true);
        syncUrl(mode);
      });
    },
    [syncUrl, redirectIfVerified],
  );

  const closeAuth = useCallback(() => {
    setIsOpen(false);
    if (parseAuthParam(searchParams.get("auth"))) syncUrl(null);
  }, [syncUrl, searchParams]);

  const handleModeChange = useCallback(
    (mode: AuthMode) => {
      setAuthMode(mode);
      syncUrl(mode);
    },
    [syncUrl],
  );

  const value = useMemo(
    () => ({ openAuth, closeAuth, authMode, isOpen }),
    [openAuth, closeAuth, authMode, isOpen],
  );

  return (
    <AuthDrawerContext.Provider value={value}>
      {children}
      <AuthDrawer
        open={isOpen}
        mode={authMode}
        onClose={closeAuth}
        onModeChange={handleModeChange}
      />
    </AuthDrawerContext.Provider>
  );
}

export function useAuthDrawer() {
  const ctx = useContext(AuthDrawerContext);
  if (!ctx) throw new Error("useAuthDrawer must be used within AuthDrawerProvider");
  return ctx;
}

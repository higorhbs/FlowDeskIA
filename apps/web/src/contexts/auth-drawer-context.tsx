"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AuthDrawer, type AuthMode } from "@/components/auth/AuthDrawer";
import { hostingHref } from "@/lib/hosting-href";

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

export function AuthDrawerProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [isOpen, setIsOpen] = useState(false);

  const syncUrl = useCallback(
    (mode: AuthMode | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (mode) params.set("auth", mode);
      else params.delete("auth");
      const query = params.toString();
      const target = query ? `${pathname}?${query}` : pathname;
      router.replace(hostingHref(target), { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const param = parseAuthParam(searchParams.get("auth"));
    if (param) {
      setAuthMode(param);
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [searchParams]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const openAuth = useCallback(
    (mode: AuthMode) => {
      setAuthMode(mode);
      setIsOpen(true);
      syncUrl(mode);
    },
    [syncUrl],
  );

  const closeAuth = useCallback(() => {
    setIsOpen(false);
    syncUrl(null);
  }, [syncUrl]);

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

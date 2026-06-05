"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { onAuthStateChanged } from "firebase/auth";
import { getClientAuth } from "@flowdesk/firebase/client";
import { businessApi } from "@/lib/api";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { isMobilePublicPath, isMobileSetupPath } from "@/lib/mobile-paths";
import { MobileDesktopPrompt } from "@/components/layout/MobileDesktopPrompt";
import { Loader2 } from "lucide-react";

export function MobileExperienceGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const isMobile = useIsMobile();
  const [authReady, setAuthReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    const auth = getClientAuth();
    const sync = () => {
      const user = auth.currentUser;
      setUid(user?.emailVerified ? user.uid : null);
      setAuthReady(true);
    };
    void auth.authStateReady().then(sync);
    return onAuthStateChanged(auth, sync);
  }, []);

  const { data: businesses, isLoading: loadingBusinesses } = useQuery({
    queryKey: ["businesses", uid],
    queryFn: businessApi.list,
    enabled: authReady && !!uid,
  });

  if (!isMobile) {
    return <div className="min-h-screen">{children}</div>;
  }

  if (isMobilePublicPath(pathname)) {
    return <>{children}</>;
  }

  const hasBusiness = (businesses?.length ?? 0) > 0;

  if (uid && loadingBusinesses && !isMobileSetupPath(pathname)) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" aria-label="Carregando" />
      </div>
    );
  }

  if (uid && hasBusiness) {
    const justCreated =
      typeof window !== "undefined" &&
      sessionStorage.getItem("flowdesk_mobile_business_created") === "1";
    if (justCreated) {
      sessionStorage.removeItem("flowdesk_mobile_business_created");
    }
    return <MobileDesktopPrompt variant={justCreated ? "setup" : "default"} />;
  }

  if (uid && !hasBusiness && isMobileSetupPath(pathname)) {
    return <>{children}</>;
  }

  if (!uid) {
    return <>{children}</>;
  }

  return <MobileDesktopPrompt variant="setup" />;
}

"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAppRouter } from "@/lib/app-navigation";
import { useRequiresBusinessSetup } from "@/hooks/use-requires-business-setup";
import { Loader2 } from "lucide-react";

export const CREATE_BUSINESS_PATH = "/businesses/new";
const ALLOWED_WITHOUT_BUSINESS_PATHS = new Set(["/profile"]);

export function normalizeAppPath(path: string) {
  const base = path.split("?")[0]?.replace(/\/$/, "") ?? "";
  return base || "/";
}

export function isCreateBusinessPath(path: string) {
  return normalizeAppPath(path) === CREATE_BUSINESS_PATH;
}

function isAllowedWithoutBusinessPath(path: string) {
  return ALLOWED_WITHOUT_BUSINESS_PATHS.has(normalizeAppPath(path));
}

function isDashboardPath(path: string) {
  return normalizeAppPath(path) === "/dashboard";
}

export function RequireBusinessGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useAppRouter();
  const { loading, active, hasBusiness } = useRequiresBusinessSetup();
  const onCreatePage = isCreateBusinessPath(pathname);
  const onAllowedPage = isAllowedWithoutBusinessPath(pathname);
  const onDashboardPage = isDashboardPath(pathname);
  const mustRedirect = !loading && active && !onCreatePage && !onAllowedPage && !onDashboardPage;
  const shouldLeaveCreatePage =
    !loading &&
    onCreatePage &&
    hasBusiness;

  useEffect(() => {
    if (!shouldLeaveCreatePage) return;
    router.replace("/dashboard");
  }, [shouldLeaveCreatePage, router]);

  useEffect(() => {
    if (!mustRedirect) return;
    router.replace(CREATE_BUSINESS_PATH);
  }, [mustRedirect, router]);

  if (loading && active && !onCreatePage && !onDashboardPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (mustRedirect || shouldLeaveCreatePage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return <>{children}</>;
}

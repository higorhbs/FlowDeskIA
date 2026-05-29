"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEffectivePathname } from "@/lib/use-effective-pathname";
import { businessApi } from "./api";
import { useAuth } from "@/contexts/auth-context";
import {
  inBusinessArea,
  resolveBusinessId,
  persistBusinessId,
  persistBusinessSnapshot,
  HOSTING_PLACEHOLDER_BUSINESS_ID,
} from "./business-route";

export { HOSTING_PLACEHOLDER_BUSINESS_ID, persistBusinessId, persistBusinessSnapshot } from "./business-route";

type UseBusinessIdOptions = { required?: boolean };

function clientPathname(fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return window.location.pathname || fallback;
}

export function useBusinessId(opts: UseBusinessIdOptions = { required: true }): string {
  const pathname = useEffectivePathname();
  const routePath = clientPathname(pathname);
  const onBusinessRoute = inBusinessArea(routePath);

  const { uid, ready } = useAuth();

  const { data: businesses } = useQuery({
    queryKey: ["businesses", uid],
    queryFn: businessApi.list,
    enabled: ready && !!uid && onBusinessRoute,
    staleTime: 10 * 60 * 1000,
  });

  const tenant = businesses?.[0];
  useEffect(() => {
    if (tenant) persistBusinessSnapshot(tenant);
  }, [tenant?.id, tenant?.type]);

  if (!onBusinessRoute) return "";

  const id = resolveBusinessId(routePath, businesses);

  if (id && id !== HOSTING_PLACEHOLDER_BUSINESS_ID) {
    return id;
  }

  if (!ready || businesses === undefined) {
    return "";
  }

  return "";
}

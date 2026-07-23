"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { businessApi } from "./api";
import { useAuth } from "@/contexts/auth-context";
import {
  inBusinessArea,
  pathBusinessSegment,
  resolveBusinessId,
  persistBusinessId,
  persistBusinessSnapshot,
  HOSTING_PLACEHOLDER_BUSINESS_ID,
} from "./business-route";

export { HOSTING_PLACEHOLDER_BUSINESS_ID, persistBusinessId, persistBusinessSnapshot } from "./business-route";

type UseBusinessIdOptions = { required?: boolean };

export function useBusinessId(opts: UseBusinessIdOptions = { required: true }): string {
  const pathname = usePathname() ?? "";
  const onBusinessRoute = inBusinessArea(pathname);

  const { uid, ready } = useAuth();

  const { data: businesses } = useQuery({
    queryKey: ["businesses", uid],
    queryFn: businessApi.list,
    enabled: ready && !!uid && onBusinessRoute,
    staleTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const tenant = businesses?.[0];
  useEffect(() => {
    if (tenant) persistBusinessSnapshot(tenant);
  }, [tenant?.id, tenant?.type]);

  if (!onBusinessRoute) return "";

  const id = resolveBusinessId(pathname, businesses);
  if (id && id !== HOSTING_PLACEHOLDER_BUSINESS_ID) return id;

  const segment = pathBusinessSegment(pathname);
  if (segment && segment !== HOSTING_PLACEHOLDER_BUSINESS_ID) return segment;

  return "";
}

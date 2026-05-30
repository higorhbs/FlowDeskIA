"use client";

import { useQuery } from "@tanstack/react-query";
import { businessApi, tenantApi } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { LGPD_POLICY_VERSION } from "@/lib/lgpd-policy";

export function useRequiresBusinessSetup() {
  const { uid, ready } = useAuth();

  const { data: tenant, isLoading: loadingTenant } = useQuery({
    queryKey: ["tenant", uid],
    queryFn: () => tenantApi.get(),
    enabled: ready && !!uid,
  });

  const { data: businesses, isLoading: loadingBusinesses } = useQuery({
    queryKey: ["businesses", uid],
    queryFn: businessApi.list,
    enabled: ready && !!uid,
  });

  const lgpdOk =
    !!tenant?.lgpdAcceptedAt && tenant.lgpdPolicyVersion === LGPD_POLICY_VERSION;
  const onboardingDone = !!tenant?.onboardingCompletedAt;
  const hasBusiness = (businesses?.length ?? 0) > 0;
  const loading = ready && !!uid && (loadingTenant || loadingBusinesses);
  const active = lgpdOk && onboardingDone && !hasBusiness;

  return { loading, active, hasBusiness, lgpdOk, onboardingDone };
}

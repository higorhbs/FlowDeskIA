"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBusinessVocabulary } from "@zapflow/shared";
import { businessApi } from "./api";
import { useBusinessId } from "./use-business-id";
import { useAuth } from "@/contexts/auth-context";
import { persistBusinessSnapshot, resolveBusinessType } from "./business-route";

export function useBusinessVocabulary(opts?: { requiredId?: boolean }) {
  const businessId = useBusinessId({ required: opts?.requiredId ?? true });
  const { uid, ready } = useAuth();

  const { data: businesses } = useQuery({
    queryKey: ["businesses", uid],
    queryFn: businessApi.list,
    enabled: ready && !!uid,
    staleTime: 10 * 60 * 1000,
  });

  const { data: business } = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => businessApi.get(businessId),
    enabled: ready && !!uid && !!businessId,
  });

  const type = resolveBusinessType(businessId, business, businesses);

  useEffect(() => {
    if (business?.id && business.type) persistBusinessSnapshot(business);
    else if (businessId && type) {
      const row = businesses?.find((b) => b.id === businessId) ?? businesses?.[0];
      if (row) persistBusinessSnapshot(row);
    }
  }, [business, businessId, type, businesses]);

  const vocab = getBusinessVocabulary(type);
  return Object.assign(vocab, { businessType: type, businessId });
}

export type BusinessVocabularyWithType = ReturnType<typeof useBusinessVocabulary>;

export { getBusinessVocabulary };

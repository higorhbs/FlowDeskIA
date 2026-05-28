"use client";

import { useQuery } from "@tanstack/react-query";
import { getBusinessVocabulary } from "@zapflow/shared";
import { businessApi } from "./api";
import { useBusinessId } from "./use-business-id";
import { useAuth } from "@/contexts/auth-context";

export function useBusinessVocabulary() {
  const businessId = useBusinessId();
  const { uid, ready } = useAuth();
  const { data: business } = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => businessApi.get(businessId),
    enabled: ready && !!uid && !!businessId,
  });
  const vocab = getBusinessVocabulary(business?.type);
  return Object.assign(vocab, { businessType: business?.type as string | undefined });
}

export type BusinessVocabularyWithType = ReturnType<typeof useBusinessVocabulary>;

export { getBusinessVocabulary };

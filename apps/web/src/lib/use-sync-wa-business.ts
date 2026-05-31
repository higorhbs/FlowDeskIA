"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { whatsappApi, businessApi } from "@/lib/api";
import { invalidateBusinessData } from "@/lib/invalidate-business";

export function useSyncWhatsAppBusiness(businessId: string) {
  const queryClient = useQueryClient();
  const lastSynced = useRef<boolean | null>(null);

  const businessQuery = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => businessApi.get(businessId),
    enabled: !!businessId,
    staleTime: 5_000,
  });

  const query = useQuery({
    queryKey: ["wa-status", businessId],
    queryFn: () => whatsappApi.status(businessId),
    enabled: !!businessId,
    refetchInterval: (q) => {
      const live = q.state.data?.connected === true;
      const stored = businessQuery.data?.isConnected === true;
      if (live || stored) return 15000;
      if (q.state.data?.qr) return 800;
      if (q.state.data?.status === "connecting" || q.state.data?.status === "qr") return 800;
      if (q.state.status === "error") return 4000;
      return 2000;
    },
    retry: 2,
  });

  const waLive = query.data?.connected === true;
  const stored = businessQuery.data?.isConnected === true;
  const connected = waLive || stored;

  useEffect(() => {
    if (!businessId) return;
    const waKnown = query.data?.connected !== undefined;
    if (!waKnown && !businessQuery.isFetched) return;
    if (lastSynced.current === connected) return;
    lastSynced.current = connected;
    void businessApi.setConnected(businessId, connected).then(() => {
      invalidateBusinessData(queryClient, businessId);
    });
  }, [connected, businessId, query.data?.connected, businessQuery.isFetched, queryClient]);

  return {
    ...query,
    data: query.data
      ? { ...query.data, connected }
      : connected
        ? { connected: true, status: "open" as const }
        : undefined,
    connected,
    isLoading: query.isLoading || businessQuery.isLoading,
    isFetched: query.isFetched && businessQuery.isFetched,
  };
}

export function markWhatsAppConnected(
  queryClient: ReturnType<typeof useQueryClient>,
  businessId: string,
  connected: boolean,
  lastSyncedRef: MutableRefObject<boolean | null>
) {
  lastSyncedRef.current = connected;
  return businessApi.setConnected(businessId, connected).then(() => {
    invalidateBusinessData(queryClient, businessId);
    void queryClient.invalidateQueries({ queryKey: ["wa-status", businessId] });
  });
}

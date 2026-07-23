"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { whatsappApi, businessApi } from "@/lib/api";
import { useStableBoolean } from "@/lib/use-stable-boolean";

export function useSyncWhatsAppBusiness(businessId: string) {
  const queryClient = useQueryClient();
  const lastSynced = useRef<boolean | null>(null);

  const businessQuery = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => businessApi.get(businessId),
    enabled: !!businessId,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });

  const query = useQuery({
    queryKey: ["wa-status", businessId],
    queryFn: () => whatsappApi.status(businessId),
    enabled: !!businessId,
    staleTime: (q) =>
      q.state.data?.status === "connecting" || q.state.data?.status === "qr" ? 0 : 10_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchInterval: (q) => {
      const live =
        q.state.data?.connected === true ||
        q.state.data?.status === "open" ||
        q.state.data?.status === "connected";
      const stored = businessQuery.data?.isConnected === true;
      if (live || stored) return 60_000;
      if (q.state.data?.qr) return 2_000;
      if (q.state.data?.status === "connecting" || q.state.data?.status === "qr") return 1_000;
      if (q.state.status === "error") return 15_000;
      return 8_000;
    },
    retry: 2,
  });

  const waLive =
    query.data?.connected === true ||
    query.data?.status === "open" ||
    query.data?.status === "connected";
  const stored = businessQuery.data?.isConnected === true;
  const connected = waLive || stored;
  const waStatus = query.data?.status;
  const immediateDisconnect =
    waStatus === "close" || waStatus === "disconnected" || waStatus === "unavailable";
  const connectedStable = useStableBoolean(connected, 1800, immediateDisconnect);

  useEffect(() => {
    if (!waLive || !businessId) return;
    void queryClient.invalidateQueries({ queryKey: ["business", businessId] });
  }, [waLive, businessId, queryClient]);

  useEffect(() => {
    if (!businessId) return;
    const waKnown = query.data?.connected !== undefined;
    if (!waKnown && !businessQuery.isFetched) return;
    if (lastSynced.current === connectedStable) return;
    lastSynced.current = connectedStable;
    void businessApi.setConnected(businessId, connectedStable).then(() => {
      queryClient.setQueryData(["business", businessId], (prev: { isConnected?: boolean } | undefined) =>
        prev ? { ...prev, isConnected: connectedStable } : prev,
      );
      void queryClient.invalidateQueries({ queryKey: ["businesses"] });
    });
  }, [connectedStable, businessId, query.data?.connected, businessQuery.isFetched, queryClient]);

  const isInitialLoading = !query.data && query.isPending;

  return {
    ...query,
    data: query.data
      ? { ...query.data, connected }
      : connected
        ? { connected: true, status: "open" as const }
        : undefined,
    connected,
    connectedStable,
    isInitialLoading,
    isFetched: query.isFetched && businessQuery.isFetched,
  };
}

export function patchWhatsAppStatus(
  queryClient: ReturnType<typeof useQueryClient>,
  businessId: string,
  patch: { connected: boolean; status?: string; qr?: string }
) {
  queryClient.setQueryData(["wa-status", businessId], (prev: Record<string, unknown> | undefined) => ({
    ...(prev ?? {}),
    ...patch,
  }));
}

export function markWhatsAppConnected(
  queryClient: ReturnType<typeof useQueryClient>,
  businessId: string,
  connected: boolean,
  lastSyncedRef: MutableRefObject<boolean | null>
) {
  lastSyncedRef.current = connected;
  patchWhatsAppStatus(queryClient, businessId, {
    connected,
    status: connected ? "open" : "close",
    qr: undefined,
  });
  return businessApi.setConnected(businessId, connected).then(() => {
    queryClient.setQueryData(["business", businessId], (prev: { isConnected?: boolean } | undefined) =>
      prev ? { ...prev, isConnected: connected } : prev,
    );
    void queryClient.invalidateQueries({ queryKey: ["businesses"] });
  });
}

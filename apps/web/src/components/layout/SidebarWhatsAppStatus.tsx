"use client";

import { useState } from "react";
import { AppLink as Link } from "@/components/AppLink";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { WifiOff, ChevronRight, Loader2 } from "lucide-react";
import { businessApi, whatsappApi } from "@/lib/api";
import { patchWhatsAppStatus } from "@/lib/use-sync-wa-business";
import { panelHref } from "@/lib/business-nav";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = {
  businessId: string;
  isConnected: boolean;
};

export function SidebarWhatsAppStatus({ businessId, isConnected: initialConnected }: Props) {
  const queryClient = useQueryClient();
  const [disconnectConfirm, setDisconnectConfirm] = useState(false);
  const [isConnected, setIsConnected] = useState(initialConnected);

  const disconnectMutation = useMutation({
    mutationFn: () => whatsappApi.disconnect(businessId),
    onSuccess: () => {
      setIsConnected(false);
      patchWhatsAppStatus(queryClient, businessId, {
        connected: false,
        status: "close",
        qr: undefined,
      });
      void businessApi.setConnected(businessId, false).then(() => {
        queryClient.setQueryData(["business", businessId], (prev: { isConnected?: boolean } | undefined) =>
          prev ? { ...prev, isConnected: false } : prev,
        );
        void queryClient.invalidateQueries({ queryKey: ["businesses"] });
      });
      setDisconnectConfirm(false);
      toast.success("WhatsApp desconectado");
    },
    onError: (err: Error) => toast.error(err.message ?? "Erro ao desconectar"),
  });

  if (isConnected) {
    return (
      <div className="rounded-lg bg-white/80 border border-green-200/80 overflow-hidden">
        <div className="flex items-center gap-2 px-2.5 py-2">
          <span className="relative flex w-2 h-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full w-2 h-2 bg-green-500" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-green-800 leading-none">WhatsApp online</p>
            <p className="text-[10px] text-green-600/80 mt-0.5">Recebendo mensagens</p>
          </div>
          {!disconnectConfirm && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setDisconnectConfirm(true)}
              className="shrink-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
              title="Desconectar WhatsApp"
              aria-label="Desconectar WhatsApp"
            >
              <WifiOff className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
        {disconnectConfirm && (
          <div className="flex items-center gap-1.5 px-2.5 py-2 bg-red-50/80 border-t border-red-100">
            <p className="text-[10px] text-red-700 flex-1 font-medium">Desconectar WhatsApp?</p>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setDisconnectConfirm(false)}
              disabled={disconnectMutation.isPending}
              className="text-gray-600 hover:bg-white"
            >
              Não
            </Button>
            <Button
              type="button"
              variant="destructiveSolid"
              size="xs"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              className="min-w-8"
            >
              {disconnectMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Sim"}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={panelHref(businessId, "whatsapp")}
      className="group flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/80 border border-amber-200 hover:border-amber-300 hover:bg-amber-50/90 transition-all"
    >
      <div className="w-7 h-7 rounded-md bg-amber-100 flex items-center justify-center shrink-0 group-hover:bg-amber-200 transition-colors">
        <WifiOff className="w-3.5 h-3.5 text-amber-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-amber-900 leading-none">WhatsApp offline</p>
        <p className="text-[10px] text-amber-700/80 mt-0.5">Toque para conectar</p>
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-amber-500 shrink-0 group-hover:translate-x-0.5 transition-transform" />
    </Link>
  );
}

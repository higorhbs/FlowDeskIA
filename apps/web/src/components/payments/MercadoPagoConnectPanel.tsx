"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mercadoPagoApi } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, Link2, Unlink, CheckCircle2, AlertCircle } from "lucide-react";

type MpStatus = {
  configured: boolean;
  platformConfigured: boolean;
  email: string | null;
  mpUserId: string | null;
  liveMode: boolean;
};

export function MercadoPagoConnectPanel({ businessId }: { businessId: string }) {
  const queryClient = useQueryClient();

  const { data: mp, isLoading } = useQuery({
    queryKey: ["mercadopago", businessId],
    queryFn: () => mercadoPagoApi.get(businessId) as Promise<MpStatus>,
    enabled: !!businessId,
  });

  const connect = useMutation({
    mutationFn: () => mercadoPagoApi.connect(businessId) as Promise<{ url: string }>,
    onSuccess: (data) => {
      if (!data?.url) {
        toast.error("URL de conexão indisponível");
        return;
      }
      window.location.href = data.url;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnect = useMutation({
    mutationFn: () => mercadoPagoApi.remove(businessId),
    onSuccess: () => {
      toast.success("Mercado Pago desconectado");
      queryClient.invalidateQueries({ queryKey: ["mercadopago", businessId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
      </div>
    );
  }

  const connected = Boolean(mp?.configured);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Mercado Pago</h2>
          <p className="text-sm text-gray-600 mt-1">
            Conecte uma vez. PIX cai direto na sua conta Mercado Pago.
          </p>
        </div>
        <span
          className={
            connected
              ? "inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md"
              : "inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-md"
          }
        >
          {connected ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" /> CONECTADO
            </>
          ) : (
            <>
              <AlertCircle className="w-3.5 h-3.5" /> NÃO CONECTADO
            </>
          )}
        </span>
      </div>

      {connected ? (
        <div className="space-y-3">
          {mp?.email && (
            <p className="text-sm text-gray-700">
              Conta: <span className="font-medium">{mp.email}</span>
            </p>
          )}
          <p className="text-sm text-emerald-800">PIX ativo · Recebimento instantâneo</p>
          <Button
            type="button"
            variant="outline"
            disabled={disconnect.isPending}
            onClick={() => disconnect.mutate()}
          >
            {disconnect.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Unlink className="w-4 h-4" />
            )}
            Desconectar
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {!mp?.platformConfigured && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-3 py-2">
              Plataforma sem MP_CLIENT_ID/MP_CLIENT_SECRET. Configure no backend antes de conectar.
            </p>
          )}
          <Button
            type="button"
            disabled={connect.isPending || !mp?.platformConfigured}
            onClick={() => connect.mutate()}
          >
            {connect.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Link2 className="w-4 h-4" />
            )}
            Conectar Mercado Pago
          </Button>
        </div>
      )}
    </div>
  );
}

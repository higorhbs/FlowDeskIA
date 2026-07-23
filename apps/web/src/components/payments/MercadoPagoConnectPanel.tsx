"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mercadoPagoApi } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Unlink, CheckCircle2, AlertCircle, ExternalLink, Save } from "lucide-react";

type MpStatus = {
  configured: boolean;
  accessTokenPreview: string | null;
  publicKeyPreview: string | null;
  email: string | null;
  mpUserId: string | null;
  liveMode: boolean;
  webhookUrl: string;
};

export function MercadoPagoConnectPanel({ businessId }: { businessId: string }) {
  const queryClient = useQueryClient();
  const [accessToken, setAccessToken] = useState("");
  const [publicKey, setPublicKey] = useState("");

  const { data: mp, isLoading } = useQuery({
    queryKey: ["mercadopago", businessId],
    queryFn: () => mercadoPagoApi.get(businessId) as Promise<MpStatus>,
    enabled: !!businessId,
  });

  const save = useMutation({
    mutationFn: () =>
      mercadoPagoApi.save(businessId, {
        ...(accessToken.trim() ? { accessToken: accessToken.trim() } : {}),
        ...(publicKey.trim() ? { publicKey: publicKey.trim() } : {}),
      }),
    onSuccess: () => {
      toast.success("Chaves Mercado Pago salvas!");
      setAccessToken("");
      setPublicKey("");
      queryClient.invalidateQueries({ queryKey: ["mercadopago", businessId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnect = useMutation({
    mutationFn: () => mercadoPagoApi.remove(businessId),
    onSuccess: () => {
      toast.success("Mercado Pago removido");
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
  const canSave =
    accessToken.trim().length >= 20 ||
    (connected && publicKey.trim().length >= 10);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Mercado Pago</h2>
          <p className="text-sm text-gray-600 mt-1">
            Cole as chaves da sua conta. PIX cai direto no seu Mercado Pago.
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

      {connected && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 space-y-1">
          {mp?.email && (
            <p className="text-sm text-emerald-900">
              Conta: <span className="font-medium">{mp.email}</span>
            </p>
          )}
          {mp?.accessTokenPreview && (
            <p className="text-xs text-emerald-800">Access Token: {mp.accessTokenPreview}</p>
          )}
          <p className="text-sm text-emerald-800">PIX ativo · Recebimento na sua conta</p>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <Label htmlFor="mp-access-token">Access Token *</Label>
          <Input
            id="mp-access-token"
            type="password"
            autoComplete="off"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder={
              connected ? "Novo token (deixe em branco para manter)" : "APP_USR-..."
            }
            className="mt-1 font-mono text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Suas integrações → Credenciais de produção no Mercado Pago
          </p>
        </div>
        <div>
          <Label htmlFor="mp-public-key">Public Key (opcional)</Label>
          <Input
            id="mp-public-key"
            type="password"
            autoComplete="off"
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
            placeholder={
              mp?.publicKeyPreview
                ? "Nova public key (opcional)"
                : "APP_USR-..."
            }
            className="mt-1 font-mono text-sm"
          />
        </div>
        <p className="text-xs text-gray-500">
          <a
            href="https://www.mercadopago.com.br/developers/panel/app"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-brand-700 hover:underline"
          >
            Abrir painel Mercado Pago <ExternalLink className="w-3 h-3" />
          </a>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!canSave || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Salvar chaves
          </Button>
          {connected && (
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
              Remover
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { whatsappApi } from "@/lib/api";
import { useBusinessId } from "@/lib/use-business-id";
import {
  markWhatsAppConnected,
  patchWhatsAppStatus,
  useSyncWhatsAppBusiness,
} from "@/lib/use-sync-wa-business";
import {
  WhatsAppConnectionRunner,
  resolveWhatsAppRunnerPhase,
} from "@/components/whatsapp/WhatsAppConnectionRunner";
import { toast } from "sonner";
import { Smartphone, Wifi, WifiOff, QrCode, RefreshCw, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ConnectResponse = {
  status: string;
  qr?: string;
  message?: string;
};

export default function WhatsAppPage() {
  const id = useBusinessId();
  const queryClient = useQueryClient();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const lastSyncedConnected = useRef<boolean | null>(null);
  const wasConnected = useRef(false);
  const connectStarted = useRef(false);
  const silentConnect = useRef(false);

  const {
    data: status,
    isInitialLoading,
    isError: statusError,
    failureReason: statusFailure,
    connected: isConnected,
  } = useSyncWhatsAppBusiness(id);

  const hasQr = Boolean(qrCode || status?.qr);
  const waUnavailable = status?.status === "unavailable";
  const displayQr = qrCode || (hasQr && !isConnected ? status?.qr : null);

  const connectMutation = useMutation({
    mutationFn: (force?: boolean) => whatsappApi.connect(id, force) as Promise<ConnectResponse>,
    onMutate: () => {
      setReconnecting(true);
      setConnectError(null);
    },
    onSuccess: (data) => {
      const silent = silentConnect.current;
      silentConnect.current = false;
      if (data.status === "qr" && data.qr) {
        setQrCode(data.qr);
        patchWhatsAppStatus(queryClient, id, { connected: false, status: "qr", qr: data.qr });
        if (!silent) toast.info("QR Code gerado! Escaneie com seu WhatsApp.");
      } else if (data.status === "already_connected" || data.status === "connected") {
        setQrCode(null);
        setReconnecting(false);
        patchWhatsAppStatus(queryClient, id, { connected: true, status: "open" });
      } else if (data.status === "connecting" || data.status === "pending") {
        patchWhatsAppStatus(queryClient, id, { connected: false, status: "connecting" });
      } else if (data.status === "timeout") {
        setReconnecting(false);
        toast.error(data.message ?? "QR expirou. Gere outro código.");
      } else if (data.status === "error") {
        setReconnecting(false);
        toast.error(data.message ?? "Erro ao conectar");
      } else if (!silent) {
        setReconnecting(false);
        toast.error(data.message ?? "Resposta inesperada da API");
      }
    },
    onError: (err: Error) => {
      const silent = silentConnect.current;
      silentConnect.current = false;
      connectStarted.current = false;
      setReconnecting(false);
      if (silent) return;
      const msg = err.message ?? "Erro ao iniciar conexão";
      setConnectError(msg);
      toast.error(msg);
    },
  });

  const { mutate: startConnect, isPending: isConnectPending } = connectMutation;

  useEffect(() => {
    if (isConnected) {
      setReconnecting(false);
      setQrCode(null);
    }
  }, [isConnected]);

  const runnerPhase = useMemo(
    () =>
      resolveWhatsAppRunnerPhase({
        connected: isConnected,
        reconnecting: reconnecting || isConnectPending,
        hasQr: Boolean(displayQr),
      }),
    [isConnected, reconnecting, isConnectPending, displayQr],
  );

  const showRunner =
    !isConnected && (reconnecting || isConnectPending || Boolean(displayQr));

  useEffect(() => {
    connectStarted.current = false;
    setReconnecting(false);
  }, [id]);

  useEffect(() => {
    if (isConnected || status?.qr) setConnectError(null);
  }, [isConnected, status?.qr]);

  useEffect(() => {
    if (isConnected && !wasConnected.current) {
      wasConnected.current = true;
      setQrCode(null);
      setReconnecting(false);
      toast.success("WhatsApp conectado!");
    }
    if (!isConnected) {
      wasConnected.current = false;
      if (status?.qr && !qrCode) setQrCode(status.qr);
    }
  }, [isConnected, status?.qr, qrCode]);

  useEffect(() => {
    if (isInitialLoading || waUnavailable || isConnected || hasQr) return;
    if (connectStarted.current || isConnectPending) return;
    const t = setTimeout(() => {
      if (connectStarted.current) return;
      connectStarted.current = true;
      silentConnect.current = true;
      startConnect(false);
    }, 400);
    return () => clearTimeout(t);
  }, [isInitialLoading, waUnavailable, isConnected, hasQr, isConnectPending, startConnect]);

  const disconnectMutation = useMutation({
    mutationFn: () => whatsappApi.disconnect(id),
    onMutate: () => setReconnecting(true),
    onSuccess: () => {
      setQrCode(null);
      connectStarted.current = false;
      void markWhatsAppConnected(queryClient, id, false, lastSyncedConnected);
      toast.success("WhatsApp desconectado");
      silentConnect.current = true;
      connectStarted.current = true;
      startConnect(false);
    },
    onError: (err: Error) => {
      setReconnecting(false);
      toast.error(err.message ?? "Erro ao desconectar");
    },
  });

  const waitingQr = (reconnecting || isConnectPending) && !displayQr && !isConnected;

  if (isInitialLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" aria-label="Carregando" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Conexão WhatsApp</h1>
        <p className="text-gray-500 mt-1">Conecte seu número para ativar o atendimento automático</p>
      </div>

      {waUnavailable && (
        <Card className="mb-6 flex gap-3 border-amber-200 bg-amber-50 text-sm text-amber-900">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">WhatsApp indisponível neste ambiente</p>
            <p className="mt-1 text-amber-800">
              Rode <strong>pnpm dev</strong> e acesse <strong>http://localhost:3000</strong> (API na
              porta 3001 com <code className="text-xs">ENABLE_WORKERS=true</code>).
            </p>
          </div>
        </Card>
      )}

      <Card className="text-center overflow-hidden">
        {showRunner && (
          <div className="border-b border-gray-100 bg-gradient-to-b from-white to-brand-50/30 px-2 pt-4 pb-2">
            <WhatsAppConnectionRunner phase={runnerPhase} />
          </div>
        )}

        <div className="p-6 pt-5">
          <div className="flex items-center justify-center mb-4">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors duration-500 ${
                isConnected ? "bg-green-50 ring-2 ring-green-200" : "bg-gray-100"
              }`}
            >
              {isConnected ? (
                <Wifi className="w-8 h-8 text-green-500" />
              ) : (
                <WifiOff className="w-8 h-8 text-gray-400" />
              )}
            </div>
          </div>

          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            {isConnected ? "Conectado!" : displayQr ? "Escaneie o QR Code" : "Desconectado"}
          </h2>

          {(connectError || statusError) && !isConnected && !reconnecting && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 text-left">
              <p>
                {statusError
                  ? statusFailure instanceof Error
                    ? statusFailure.message
                    : "Não foi possível consultar o status do WhatsApp."
                  : connectError}
              </p>
            </div>
          )}

          {displayQr && !isConnected && (
            <div className="mb-6">
              <div className="inline-block p-4 bg-white border-2 border-gray-200 rounded-2xl shadow-sm">
                <img src={displayQr} alt="QR Code WhatsApp" width={250} height={250} className="mx-auto" />
              </div>
              <div className="mt-4 text-sm text-gray-500 space-y-1">
                <p>1. Abra o WhatsApp no celular</p>
                <p>2. Toque em <strong>Dispositivos conectados</strong></p>
                <p>3. Toque em <strong>Conectar dispositivo</strong></p>
                <p>4. Aponte a câmera para o QR Code</p>
              </div>
            </div>
          )}

          {isConnected ? (
            <Button
              type="button"
              variant="destructiveSolid"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending || waUnavailable}
            >
              {disconnectMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <WifiOff className="w-4 h-4" />
              )}
              Desconectar
            </Button>
          ) : waitingQr ? null : (
            <Button
              onClick={() => {
                silentConnect.current = false;
                connectMutation.mutate(!!displayQr);
              }}
              disabled={connectMutation.isPending || waUnavailable}
            >
              {connectMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : displayQr ? (
                <RefreshCw className="w-4 h-4" />
              ) : (
                <QrCode className="w-4 h-4" />
              )}
              {displayQr ? "Novo QR Code" : "Gerar QR Code"}
            </Button>
          )}
        </div>
      </Card>

      {!isConnected && !hasQr && !waUnavailable && !reconnecting && !isConnectPending && (
        <Card className="mt-6 border-brand-100 bg-brand-50">
          <h3 className="font-medium text-brand-900 mb-3 flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            Como funciona
          </h3>
          <ul className="text-sm text-brand-800 space-y-2">
            <li>• Usamos o WhatsApp Web Protocol para conectar seu número</li>
            <li>• A sessão fica salva — não precisa escanear toda vez</li>
            <li>• Se deslogar no celular, basta reconectar aqui</li>
            <li>• Recomendamos usar o WhatsApp Business</li>
          </ul>
        </Card>
      )}
    </div>
  );
}

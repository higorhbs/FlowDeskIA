"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { tenantApi } from "@/lib/api";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { LGPD_POLICY_VERSION } from "@/lib/lgpd-policy";

function lgpdStorageKey(uid: string) {
  return `flowdesk:lgpd-accepted:${uid}:${LGPD_POLICY_VERSION}`;
}

function readLocalAccepted(uid: string) {
  try {
    return window.localStorage.getItem(lgpdStorageKey(uid)) === "1";
  } catch {
    return false;
  }
}

function writeLocalAccepted(uid: string) {
  try {
    window.localStorage.setItem(lgpdStorageKey(uid), "1");
  } catch {
    /* ignore quota / private mode */
  }
}

export function LgpdConsentGate() {
  const { uid, ready } = useAuth();
  const queryClient = useQueryClient();
  const [localAccepted, setLocalAccepted] = useState(false);

  useEffect(() => {
    if (!uid) {
      setLocalAccepted(false);
      return;
    }
    setLocalAccepted(readLocalAccepted(uid));
  }, [uid]);

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["tenant", uid],
    queryFn: () => tenantApi.get(),
    enabled: ready && !!uid,
    retry: 1,
  });

  const serverAccepted =
    !!tenant?.lgpdAcceptedAt && tenant.lgpdPolicyVersion === LGPD_POLICY_VERSION;

  useEffect(() => {
    if (!uid || !serverAccepted) return;
    writeLocalAccepted(uid);
    setLocalAccepted(true);
  }, [uid, serverAccepted]);

  const accept = useMutation({
    mutationFn: () => tenantApi.acceptLgpd(LGPD_POLICY_VERSION),
    onSuccess: async (updated) => {
      if (uid) {
        writeLocalAccepted(uid);
        setLocalAccepted(true);
        queryClient.setQueryData(["tenant", uid], updated);
        await queryClient.invalidateQueries({ queryKey: ["tenant", uid] });
      }
      toast.success("Preferências de privacidade salvas.");
    },
    onError: (err: Error) => {
      toast.error(err?.message ?? "Não foi possível salvar o aceite LGPD. Tente novamente.");
    },
  });

  if (!ready || !uid || isLoading) return null;
  if (localAccepted || serverAccepted) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white border border-gray-100 p-6 md:p-8">
        <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Atualização de privacidade (LGPD)</h2>
        <p className="text-sm text-gray-600 mb-5">
          Para continuar, confirme que leu nossa Política de Privacidade e Termos de Uso.
        </p>

        <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 text-sm text-gray-700 space-y-2 mb-6">
          <p>• Identificamos o controlador e o canal do encarregado na Política de Privacidade.</p>
          <p>• Tratamos dados para operação do atendimento via WhatsApp e cobrança do plano.</p>
          <p>• Você pode exportar ou excluir sua conta em Meu perfil a qualquer momento.</p>
          <p>• Registramos a versão da política que você aceitar ({LGPD_POLICY_VERSION}).</p>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <Link href="/privacy" className={buttonVariants({ variant: "outline" })} target="_blank">
            Política de Privacidade
          </Link>
          <Link href="/terms" className={buttonVariants({ variant: "outline" })} target="_blank">
            Termos de Uso
          </Link>
        </div>

        <Button
          type="button"
          className="h-10 w-full"
          onClick={() => accept.mutate()}
          disabled={accept.isPending}
        >
          {accept.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Aceito e continuar
        </Button>
      </div>
    </div>
  );
}

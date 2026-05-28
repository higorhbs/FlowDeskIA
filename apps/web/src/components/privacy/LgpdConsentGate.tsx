"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { tenantApi } from "@/lib/api";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

const LGPD_POLICY_VERSION = "2026-05-v1";

export function LgpdConsentGate() {
  const { uid, ready } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["tenant", uid],
    queryFn: () => tenantApi.get(),
    enabled: ready && !!uid,
  });

  const accept = useMutation({
    mutationFn: () => tenantApi.acceptLgpd(LGPD_POLICY_VERSION),
    onError: () => {
      setDismissed(false);
      toast.error("Não foi possível salvar o aceite LGPD. Tente novamente.");
    },
  });

  if (dismissed || isLoading || !tenant) return null;

  const mustAccept =
    !tenant.lgpdAcceptedAt || tenant.lgpdPolicyVersion !== LGPD_POLICY_VERSION;
  if (!mustAccept) return null;

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
          <p>• Tratamos dados para operação do atendimento via WhatsApp.</p>
          <p>• Você pode solicitar exportação dos seus dados a qualquer momento.</p>
          <p>• Mantemos registro de aceite da versão da política.</p>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <Link href="/privacy" className="btn-secondary" target="_blank">
            Política de Privacidade
          </Link>
          <Link href="/terms" className="btn-secondary" target="_blank">
            Termos de Uso
          </Link>
        </div>

        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            accept.mutate();
          }}
          disabled={accept.isPending}
          className="btn-primary w-full"
        >
          {accept.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Aceito e continuar
        </button>
      </div>
    </div>
  );
}


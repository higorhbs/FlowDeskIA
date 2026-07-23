"use client";

import { useQuery } from "@tanstack/react-query";
import { paymentApi } from "@/lib/api";
import { formatCurrency, cn } from "@/lib/utils";
import { APP_DISPLAY_NAME } from "@flowdesk/shared";
import { Loader2, QrCode, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MercadoPagoConnectPanel } from "@/components/payments/MercadoPagoConnectPanel";

type PaymentRow = {
  id: string;
  customerName?: string;
  customerPhone: string;
  description: string;
  amount: number;
  status: string;
  createdAt: string;
  paidAt?: string;
};

const STATUS: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  PAID: { label: "Pago", className: "text-emerald-700 bg-emerald-50", icon: CheckCircle2 },
  PENDING: { label: "Aguardando", className: "text-amber-700 bg-amber-50", icon: Clock },
  OVERDUE: { label: "Vencido", className: "text-red-700 bg-red-50", icon: AlertCircle },
  CANCELLED: { label: "Cancelado", className: "text-gray-600 bg-gray-100", icon: AlertCircle },
};

export function PaymentsPixPanel({ businessId }: { businessId: string }) {
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payments", businessId],
    queryFn: () => paymentApi.list(businessId) as Promise<PaymentRow[]>,
    enabled: !!businessId,
  });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
        <p className="text-sm font-semibold text-emerald-900">Integração focada em PIX</p>
        <p className="text-sm text-emerald-800 leading-relaxed">
          Cada negócio salva o Access Token da própria conta Mercado Pago. O PIX é gerado com
          essa chave e o valor cai direto para o dono — a plataforma não intermedia o dinheiro.
        </p>
        <p className="text-xs text-emerald-700">
          Tarifas seguem as regras comerciais do Mercado Pago na sua conta.
        </p>
      </div>
      <MercadoPagoConnectPanel businessId={businessId} />
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <QrCode className="w-4 h-4" />
          Cobranças recentes
        </h2>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          </div>
        ) : payments.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">
            Nenhuma cobrança ainda. Após conectar o Mercado Pago, o cliente digita{" "}
            <strong>pix</strong> ou escolhe pagar no menu do WhatsApp.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {payments.map((p) => {
              const st = STATUS[p.status] ?? STATUS.PENDING;
              const Icon = st.icon;
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {p.customerName || p.customerPhone}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{p.description}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {format(new Date(p.createdAt), "dd MMM yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(p.amount)}</p>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full",
                        st.className
                      )}
                    >
                      <Icon className="w-3 h-3" />
                      {st.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

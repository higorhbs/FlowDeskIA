"use client";

import { useEffect } from "react";
import { Banknote, Loader2 } from "lucide-react";
import { useBusinessId } from "@/lib/use-business-id";
import { usePlanAllowsPix } from "@/lib/use-plan-allows-pix";
import { useAppRouter } from "@/lib/app-navigation";
import { panelHref } from "@/lib/business-nav";
import { PaymentsPixPanel } from "@/components/payments/PaymentsPixPanel";

export default function PaymentsPage() {
  const businessId = useBusinessId();
  const router = useAppRouter();
  const { pixEnabled, isLoading } = usePlanAllowsPix();

  useEffect(() => {
    if (!businessId || isLoading) return;
    if (!pixEnabled) router.replace(panelHref(businessId, "faqs"));
  }, [businessId, isLoading, pixEnabled, router]);

  if (isLoading || !pixEnabled) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-brand-500 to-teal-500 p-6 mb-8 shadow-lg">
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-12 -left-6 w-48 h-48 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-sm flex-shrink-0">
            <Banknote className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Pagamentos por PIX</h1>
            <p className="text-white/80 text-sm mt-0.5">
              Salve suas chaves Mercado Pago e receba PIX no WhatsApp
            </p>
          </div>
        </div>
      </div>
      <PaymentsPixPanel businessId={businessId} />
    </div>
  );
}

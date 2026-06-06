"use client";

import { useEffect } from "react";
import type { Business, Tenant } from "@flowdesk/firebase/client";
import { getBusinessTypeLabel } from "@/lib/utils";
import { APP_DISPLAY_NAME } from "@flowdesk/shared";
import { getBusinessVocabulary } from "@flowdesk/shared";
import { AppLink as Link } from "@/components/AppLink";
import { persistBusinessSnapshot } from "@/lib/use-business-id";
import { buttonVariants } from "@/components/ui/button";
import { Wifi, WifiOff, Store, ChevronRight } from "lucide-react";
import { buildBusinessPanelLinks } from "@/lib/business-panel-nav";
import { planAllowsPix } from "@/lib/plan-features";

type Props = {
  tenant: Tenant | null;
  business: Business | null;
};

export function BusinessesPageClient({ tenant, business }: Props) {
  const pixEnabled = planAllowsPix(tenant?.plan);

  useEffect(() => {
    if (business?.id && business.type) persistBusinessSnapshot(business);
  }, [business?.id, business?.type]);

  if (!business) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
          <Store className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Nenhum negócio cadastrado</h2>
        <p className="text-gray-500 mb-6">Cadastre seu negócio para começar a usar o {APP_DISPLAY_NAME}.</p>
        <Link href="/businesses/new" className={buttonVariants()}>
          Cadastrar meu negócio
        </Link>
      </div>
    );
  }

  const initials = business.name
    .trim().split(/\s+/).slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm mb-5 overflow-hidden">
        <div className="h-1 bg-brand-600" />
        <div className="flex items-center gap-4 p-5">
          <div className="w-14 h-14 rounded-xl bg-brand-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-gray-900 text-lg font-bold leading-tight truncate">{business.name}</p>
            <p className="text-gray-500 text-sm mt-0.5">
              {getBusinessTypeLabel(business.type, business.typeLabel)}
              {business.phone && <> · {business.phone}</>}
            </p>
            {business.address && (
              <p className="text-gray-400 text-xs mt-0.5 truncate">{business.address}</p>
            )}
          </div>
          <div className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
            business.isConnected
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-gray-50 text-gray-500 border-gray-200"
          }`}>
            {business.isConnected
              ? <><Wifi className="w-3.5 h-3.5" /> Conectado</>
              : <><WifiOff className="w-3.5 h-3.5" /> Desconectado</>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {buildBusinessPanelLinks({
          businessId: business.id,
          vocabulary: getBusinessVocabulary(business.type),
          pixEnabled,
          layout: "hub",
        }).map(({ href, icon: Icon, label, desc, color }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 hover:border-brand-300 hover:shadow-md transition-all"
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
              <Icon className="w-4.5 h-4.5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900 leading-tight">{label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand-500 transition-colors self-end" />
          </Link>
        ))}
      </div>
    </div>
  );
}

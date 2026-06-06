import { getBusinessTypeLabel } from "@/lib/utils";
import { loadSidebarBusiness } from "@/lib/server/data/sidebar";
import { SidebarWhatsAppStatus } from "@/components/layout/SidebarWhatsAppStatus";

type Props = {
  uid: string;
  businessId: string;
};

function businessInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export async function SidebarBusinessCard({ uid, businessId }: Props) {
  const business = await loadSidebarBusiness(uid, businessId);

  return (
    <div className="shrink-0 mx-3 mt-3 mb-1 rounded-xl bg-brand-50 border border-brand-100 p-3">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {businessInitials(business.name)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{business.name}</p>
          <p className="text-xs text-gray-500 truncate">
            {getBusinessTypeLabel(business.type, business.typeLabel)}
          </p>
        </div>
      </div>
      <div className="mt-3 pt-2.5 border-t border-brand-100">
        <SidebarWhatsAppStatus businessId={businessId} isConnected={business.isConnected} />
      </div>
    </div>
  );
}

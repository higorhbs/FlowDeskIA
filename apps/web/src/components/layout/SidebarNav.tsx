"use client";

import { AppLink as Link } from "@/components/AppLink";
import { usePathname } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import type { BusinessVocabulary } from "@flowdesk/shared";
import { cn } from "@/lib/utils";
import { BusinessNavLink } from "@/components/layout/BusinessNavLink";
import { buildBusinessPanelLinks } from "@/lib/business-panel-nav";

type Props = {
  businessId?: string;
  vocabulary: BusinessVocabulary;
  pixEnabled: boolean;
  conversationsBadge?: React.ReactNode;
};

export function SidebarNav({ businessId, vocabulary, pixEnabled, conversationsBadge }: Props) {
  const pathname = usePathname() ?? "";

  const businessLinks = businessId
    ? buildBusinessPanelLinks({
        businessId,
        vocabulary,
        pixEnabled,
        layout: "sidebar",
      })
    : [];

  return (
    <nav className="flex-1 min-h-0 px-3 py-3 overflow-y-auto overscroll-contain">
      {businessLinks.length > 0 && (
        <>
          <p className="px-3 mb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            Painel do negócio
          </p>
          <div className="space-y-0.5 mb-4">
            {businessLinks.map(({ href, icon: Icon, label, badgeKey }) => (
              <BusinessNavLink
                key={href}
                href={href}
                icon={Icon}
                label={label}
                badge={badgeKey === "conversations" ? conversationsBadge : undefined}
              />
            ))}
          </div>
          <div className="h-px bg-gray-100 mx-2 mb-3" />
        </>
      )}
      <p className="px-3 mb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Geral</p>
      <div className="space-y-0.5">
        <Link
          href="/dashboard"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            pathname === "/dashboard"
              ? "bg-brand-50 text-brand-700"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
          )}
        >
          <LayoutDashboard className="w-4 h-4" />
          Dashboard
        </Link>
      </div>
    </nav>
  );
}

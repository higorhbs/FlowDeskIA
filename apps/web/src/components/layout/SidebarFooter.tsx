"use client";

import { useState } from "react";
import { AppLink as Link } from "@/components/AppLink";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, CreditCard, LifeBuoy } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSupportMailtoUrl } from "@/lib/legal-config";
import { LogoutConfirmDialog } from "@/components/auth/LogoutConfirmDialog";
import { signOutAndReset } from "@/lib/session-reset";
import { useAppRouter } from "@/lib/app-navigation";
import { SidebarProfile } from "@/components/layout/SidebarProfile";
import { Button } from "@/components/ui/button";

type Props = {
  hasBusiness: boolean;
};

export function SidebarFooter({ hasBusiness }: Props) {
  const pathname = usePathname() ?? "";
  const router = useAppRouter();
  const queryClient = useQueryClient();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  async function confirmLogout() {
    setLogoutLoading(true);
    try {
      await signOutAndReset(queryClient);
      setLogoutOpen(false);
      router.push("/");
    } finally {
      setLogoutLoading(false);
    }
  }

  return (
    <>
      <div className="shrink-0 px-3 py-3 border-t border-gray-100 bg-white">
        <a
          href={getSupportMailtoUrl("Suporte FlowDesk")}
          target="_blank"
          rel="noreferrer"
          className="mb-1 flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
        >
          <LifeBuoy className="w-4 h-4" />
          Suporte
        </a>
        {!hasBusiness && (
          <Link
            href="/plan"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1",
              pathname === "/plan"
                ? "bg-brand-50 text-brand-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
            )}
          >
            <CreditCard className="w-4 h-4" />
            Meu plano
          </Link>
        )}
        <SidebarProfile />
        <Button
          type="button"
          variant="ghost"
          onClick={() => setLogoutOpen(true)}
          className="w-full justify-start gap-3 px-3 py-2 h-auto text-gray-600 hover:bg-gray-50 hover:text-red-600"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </Button>
      </div>
      <LogoutConfirmDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        onConfirm={confirmLogout}
        loading={logoutLoading}
      />
    </>
  );
}

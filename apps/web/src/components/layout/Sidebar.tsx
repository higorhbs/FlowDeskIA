"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MessageSquare, LayoutDashboard, Store, Calendar,
  Bot, Settings, LogOut, CreditCard,
  Wifi, WifiOff, ChevronLeft, BookOpen, Banknote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { removeToken } from "@/lib/auth";
import { logoutFirebase } from "@/lib/firebase-auth";
import { useRouter } from "next/navigation";
import { SidebarProfile } from "./SidebarProfile";
import { useQuery } from "@tanstack/react-query";
import { businessApi } from "@/lib/api";
import { BUSINESS_TYPE_LABELS } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { uid, ready } = useAuth();

  const businessIdMatch = pathname.match(/\/businesses\/([^/]+)/);
  const businessId = businessIdMatch?.[1];

  const { data: business } = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => businessApi.get(businessId!),
    enabled: !!businessId && ready && !!uid,
  });

  const baseLinks = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/businesses", icon: Store, label: "Meu negócio" },
  ];

  const businessLinks = businessId
    ? [
        { href: `/businesses/${businessId}/conversations`, icon: MessageSquare, label: "Conversas" },
        { href: `/businesses/${businessId}/appointments`, icon: Calendar, label: "Agendamentos" },
        { href: `/businesses/${businessId}/catalog`, icon: BookOpen, label: "Catálogo" },
        { href: `/businesses/${businessId}/payments`, icon: Banknote, label: "Pagamentos" },
        { href: `/businesses/${businessId}/faqs`, icon: Bot, label: "Bot" },
        { href: `/businesses/${businessId}/whatsapp`, icon: MessageSquare, label: "WhatsApp" },
        { href: `/businesses/${businessId}/settings`, icon: Settings, label: "Configurações" },
      ]
    : [];

  async function handleLogout() {
    await logoutFirebase();
    removeToken();
    router.push("/");
  }

  const businessInitials = business?.name
    ? business.name.trim().split(/\s+/).slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()
    : "–";

  return (
    <aside className="hidden lg:flex w-64 flex-shrink-0 bg-white border-r border-gray-200 flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-gray-900">ZapFlow</span>
      </div>

      {/* Business context card */}
      {businessId && (
        <div className="mx-3 mt-3 mb-1 rounded-xl bg-brand-50 border border-brand-100 p-3">
          <Link
            href="/businesses"
            className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium mb-2 transition-colors"
          >
            <ChevronLeft className="w-3 h-3" />
            Meu negócio
          </Link>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {businessInitials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
                {business?.name ?? "Carregando…"}
              </p>
              {business && (
                <p className="text-xs text-gray-500 truncate">
                  {BUSINESS_TYPE_LABELS[business.type] ?? business.type}
                </p>
              )}
            </div>
          </div>

          {business && (
            <div className="mt-2.5 flex items-center gap-1.5">
              {business.isConnected ? (
                <>
                  <Wifi className="w-3 h-3 text-green-600" />
                  <span className="text-xs font-medium text-green-700">WhatsApp conectado</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-500">WhatsApp desconectado</span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto">
        {businessLinks.length > 0 ? (
          <>
            <p className="px-3 mb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              Painel do negócio
            </p>
            <div className="space-y-0.5 mb-4">
              {businessLinks.map(({ href, icon: Icon, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    pathname.startsWith(href)
                      ? "bg-brand-50 text-brand-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              ))}
            </div>
            <div className="h-px bg-gray-100 mx-2 mb-3" />
            <p className="px-3 mb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              Geral
            </p>
          </>
        ) : null}

        <div className="space-y-0.5">
          {baseLinks.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-brand-50 text-brand-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </div>
      </nav>

      <div className="px-3 py-3 border-t border-gray-100">
        {!businessId && (
          <Link
            href="/plan"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1",
              pathname === "/plan"
                ? "bg-brand-50 text-brand-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <CreditCard className="w-4 h-4" />
            Meu plano
          </Link>
        )}
        <SidebarProfile />
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}

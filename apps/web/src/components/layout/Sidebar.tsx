"use client";

import { useState } from "react";
import { AppLink as Link } from "@/components/AppLink";
import { usePathname } from "next/navigation";
import {
  MessageSquare,
  LayoutDashboard,
  Store,
  Calendar,
  Settings,
  LogOut,
  CreditCard,
  WifiOff,
  ChevronRight,
  BookOpen,
  Banknote,
  Loader2,
  LifeBuoy,
  CircleDot,
} from "lucide-react";
import { cn, getBusinessTypeLabel } from "@/lib/utils";
import { APP_DISPLAY_NAME } from "@flowdesk/shared";
import { LogoutConfirmDialog } from "@/components/auth/LogoutConfirmDialog";
import { signOutAndReset } from "@/lib/session-reset";
import { useAppRouter } from "@/lib/app-navigation";
import { SidebarProfile } from "./SidebarProfile";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { businessApi, whatsappApi, conversationApi } from "@/lib/api";
import { patchWhatsAppStatus } from "@/lib/use-sync-wa-business";
import { useBusinessVocabulary } from "@/lib/use-business-vocabulary";
import { VocabLabel } from "@/components/layout/VocabLabel";
import { BusinessNavLink } from "@/components/layout/BusinessNavLink";
import { panelHref } from "@/lib/business-nav";
import { IaIcon } from "@/lib/ia-brand";
import { usePlanAllowsPix } from "@/lib/use-plan-allows-pix";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";

import { getSupportMailtoUrl } from "@/lib/legal-config";
import { Button } from "@/components/ui/button";

export function Sidebar() {
  const pathname = usePathname();
  const router = useAppRouter();
  const { uid, ready } = useAuth();

  const v = useBusinessVocabulary({ requiredId: false });
  const businessId = v.businessId || undefined;

  const { pixEnabled } = usePlanAllowsPix();

  const queryClient = useQueryClient();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [disconnectConfirm, setDisconnectConfirm] = useState(false);

  const { data: business } = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => businessApi.get(businessId!),
    enabled: !!businessId && ready && !!uid,
  });

  const { data: openConvs } = useQuery({
    queryKey: ["conversations-open-count", businessId],
    queryFn: () => conversationApi.list(businessId!, { status: "OPEN" }),
    enabled: !!businessId && ready && !!uid,
    refetchInterval: 30_000,
  });

  const unreadCount = openConvs?.total ?? 0;

  const disconnectMutation = useMutation({
    mutationFn: () => whatsappApi.disconnect(businessId!),
    onSuccess: () => {
      if (!businessId) return;
      patchWhatsAppStatus(queryClient, businessId, {
        connected: false,
        status: "close",
        qr: undefined,
      });
      void businessApi.setConnected(businessId, false).then(() => {
        queryClient.setQueryData(["business", businessId], (prev: { isConnected?: boolean } | undefined) =>
          prev ? { ...prev, isConnected: false } : prev,
        );
        void queryClient.invalidateQueries({ queryKey: ["businesses"] });
      });
      setDisconnectConfirm(false);
      toast.success("WhatsApp desconectado");
    },
    onError: (err: Error) => toast.error(err.message ?? "Erro ao desconectar"),
  });

  const baseLinks = [{ href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" }];

  const businessLinks = [
    { href: "/businesses", icon: Store, label: "Meu negócio", vocab: false as const },
    ...(businessId
      ? [
          { href: panelHref(businessId, "conversations"), icon: MessageSquare, label: "Conversas", vocab: false as const },
          { href: panelHref(businessId, "faqs"), icon: IaIcon, label: "IA", vocab: false as const },
          { href: panelHref(businessId, "appointments"), icon: Calendar, label: v.bookingsNav, vocab: true as const },
          { href: panelHref(businessId, "catalog"), icon: BookOpen, label: v.catalogNav, vocab: true as const },
          { href: panelHref(businessId, "status"), icon: CircleDot, label: "Stories", vocab: false as const },
          ...(pixEnabled
            ? [{ href: panelHref(businessId, "payments"), icon: Banknote, label: "Pagamentos", vocab: false as const }]
            : []),
          { href: panelHref(businessId, "whatsapp"), icon: MessageSquare, label: "WhatsApp", vocab: false as const },
          { href: panelHref(businessId, "settings"), icon: Settings, label: "Configurações", vocab: false as const },
        ]
      : []),
  ];

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

  const businessInitials = business?.name
    ? business.name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w: string) => w[0])
        .join("")
        .toUpperCase()
    : "–";

  return (
    <aside className="hidden lg:flex sticky top-0 z-30 w-64 shrink-0 self-start h-dvh max-h-dvh flex-col overflow-hidden bg-white border-r border-gray-200">
      <div className="shrink-0 flex items-center gap-2 px-5 py-4 border-b border-gray-100">
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-gray-900">{APP_DISPLAY_NAME}</span>
      </div>

      {/* Business context card */}
      {businessId && (
        <div className="shrink-0 mx-3 mt-3 mb-1 rounded-xl bg-brand-50 border border-brand-100 p-3">
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
                  {getBusinessTypeLabel(business.type, business.typeLabel)}
                </p>
              )}
            </div>
          </div>

          {business && (
            <div className="mt-3 pt-2.5 border-t border-brand-100">
              {business.isConnected ? (
                <div className="rounded-lg bg-white/80 border border-green-200/80 overflow-hidden">
                  <div className="flex items-center gap-2 px-2.5 py-2">
                    <span className="relative flex w-2 h-2 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full w-2 h-2 bg-green-500" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-green-800 leading-none">WhatsApp online</p>
                      <p className="text-[10px] text-green-600/80 mt-0.5">Recebendo mensagens</p>
                    </div>
                    {!disconnectConfirm && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setDisconnectConfirm(true)}
                        className="shrink-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                        title="Desconectar WhatsApp"
                        aria-label="Desconectar WhatsApp"
                      >
                        <WifiOff className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  {disconnectConfirm && (
                    <div className="flex items-center gap-1.5 px-2.5 py-2 bg-red-50/80 border-t border-red-100">
                      <p className="text-[10px] text-red-700 flex-1 font-medium">Desconectar WhatsApp?</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => setDisconnectConfirm(false)}
                        disabled={disconnectMutation.isPending}
                        className="text-gray-600 hover:bg-white"
                      >
                        Não
                      </Button>
                      <Button
                        type="button"
                        variant="destructiveSolid"
                        size="xs"
                        onClick={() => disconnectMutation.mutate()}
                        disabled={disconnectMutation.isPending}
                        className="min-w-8"
                      >
                        {disconnectMutation.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          "Sim"
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href={panelHref(businessId, "whatsapp")}
                  className="group flex w-full items-center gap-2.5 px-2.5 py-2 rounded-lg bg-white/80 border border-amber-200 hover:border-amber-300 hover:bg-amber-50/90 transition-all"
                >
                  <div className="w-7 h-7 rounded-md bg-amber-100 flex items-center justify-center shrink-0 group-hover:bg-amber-200 transition-colors">
                    <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-amber-900 leading-none">WhatsApp offline</p>
                    <p className="text-[10px] text-amber-700/80 mt-0.5">Toque para conectar</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-amber-500 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 min-h-0 px-3 py-3 overflow-y-auto overscroll-contain">
        <>
          <p className="px-3 mb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            Painel do negócio
          </p>
          <div className="space-y-0.5 mb-4">
            {businessLinks.map(({ href, icon: Icon, label, vocab }) => {
                const isConversations = label === "Conversas";
                const text = vocab ? (
                  <VocabLabel ready={v.vocabReady}>{label}</VocabLabel>
                ) : (
                  label
                );
                return (
                  <BusinessNavLink
                    key={href}
                    href={href}
                    icon={Icon}
                    label={text}
                    badge={
                      isConversations && unreadCount > 0 ? (
                        <span
                          className={cn(
                            "ml-auto inline-flex shrink-0 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold leading-none text-white tabular-nums",
                            unreadCount > 9 ? "h-[18px] min-w-[22px] px-1" : "size-[18px]"
                          )}
                        >
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      ) : undefined
                    }
                  />
                );
            })}
          </div>
          <div className="h-px bg-gray-100 mx-2 mb-3" />
          <p className="px-3 mb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            Geral
          </p>
        </>

        <div className="space-y-0.5">
          {baseLinks.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-brand-50 text-brand-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </div>
      </nav>

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
        {!businessId && (
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
    </aside>
  );
}

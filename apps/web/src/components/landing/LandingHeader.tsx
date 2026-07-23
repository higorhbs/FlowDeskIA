"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Menu, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_DISPLAY_NAME, STARTER_TRIAL_DAYS } from "@flowdesk/shared";
import { useAuthDrawer } from "@/contexts/auth-drawer-context";
import { cn } from "@/lib/utils";
import { getSupportMailtoUrl } from "@/lib/legal-config";

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const NAV_ORGANIC = [
  { label: "Início", href: "#hero", type: "link" as const },
  { label: "Recursos", id: "recursos" as const },
  { label: "Relatos", id: "clientes" as const },
  { label: "Preços", id: "precos" as const },
  { label: "Contato", action: "email" as const },
] as const;

const NAV_AD = [
  { label: "Início", href: "#hero", type: "link" as const },
  { label: "Recursos", id: "recursos" as const },
  { label: "Relatos", id: "clientes" as const },
  { label: "Preços", id: "precos" as const },
  { label: "Contato", action: "email" as const },
] as const;

export function LandingHeader({ adMode = false }: { adMode?: boolean }) {
  const NAV = adMode ? NAV_AD : NAV_ORGANIC;
  const { openAuth } = useAuthDrawer();
  const [menuOpen, setMenuOpen] = useState(false);
  const supportEmail = getSupportMailtoUrl("Contato FlowDesk");

  function runNav(item: (typeof NAV)[number]) {
    setMenuOpen(false);
    if ("href" in item && item.href) {
      document.querySelector(item.href)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if ("id" in item && item.id) scrollToSection(item.id);
    if ("action" in item && item.action === "email") window.open(supportEmail, "_blank");
  }

  return (
    <header className="relative z-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-10">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-primary">
            {APP_DISPLAY_NAME}
          </span>
          <span className="flex size-9 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
            <MessageSquare className="size-4 text-primary" />
          </span>
        </Link>

        <nav
          aria-label="Principal"
          className="hidden items-center rounded-full border border-primary/15 bg-secondary px-2 py-1.5 md:flex"
        >
          {NAV.map((item) =>
            "href" in item && item.href ? (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-full px-5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-background hover:text-primary"
              >
                {item.label}
              </Link>
            ) : (
              <Button
                key={item.label}
                type="button"
                variant="ghost"
                onClick={() => runNav(item)}
                className="h-auto rounded-full px-5 py-2 text-sm font-medium text-muted-foreground hover:bg-background hover:text-primary"
              >
                {item.label}
              </Button>
            )
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => openAuth("login")}
            className="hidden h-10 rounded-full px-4 text-muted-foreground hover:bg-transparent hover:text-primary sm:inline-flex"
          >
            Entrar
          </Button>
          <Button
            type="button"
            onClick={() => openAuth("register")}
            className="hidden h-10 gap-1.5 rounded-full px-5 hover:bg-brand-700 sm:inline-flex"
          >
            {adMode ? `Teste grátis ${STARTER_TRIAL_DAYS} dias` : "Testar grátis"}
            <ArrowUpRight />
          </Button>
          <Button
            type="button"
            onClick={() => openAuth("register")}
            className="h-9 rounded-full px-4 text-sm hover:bg-brand-700 md:hidden"
          >
            {adMode ? "Teste grátis" : "Testar"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-full border-primary/15 text-primary md:hidden"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "overflow-hidden border-t border-primary/10 bg-[#f7f7f5]/95 backdrop-blur-md transition-[max-height,opacity] duration-300 md:hidden",
          menuOpen ? "max-h-80 opacity-100" : "max-h-0 opacity-0 border-t-0"
        )}
      >
        <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3" aria-label="Menu mobile">
          {NAV.map((item) => (
            <Button
              key={item.label}
              type="button"
              variant="ghost"
              onClick={() => runNav(item)}
              className="h-auto w-full justify-start rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-brand-50 hover:text-brand-700"
            >
              {item.label}
            </Button>
          ))}
          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-gray-200/80 pt-3">
            <Button type="button" variant="outline" className="w-full" onClick={() => { setMenuOpen(false); openAuth("login"); }}>
              Entrar
            </Button>
            <Button type="button" className="w-full" onClick={() => { setMenuOpen(false); openAuth("register"); }}>
              Testar grátis
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}

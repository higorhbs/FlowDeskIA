"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { useRequiresBusinessSetup } from "@/hooks/use-requires-business-setup";
import { isCreateBusinessPath } from "@/components/business/RequireBusinessGate";
import { usePathname } from "next/navigation";

export function DashboardChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { active } = useRequiresBusinessSetup();
  const setupMode = active && isCreateBusinessPath(pathname);

  if (setupMode) {
    return (
      <div className="min-h-screen bg-gray-50 overflow-auto" style={{ scrollbarGutter: "stable" }}>
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-auto pb-20 lg:pb-0" style={{ scrollbarGutter: "stable" }}>
        {children}
      </main>
      <MobileNav />
    </div>
  );
}

"use client";

import { usePathname } from "next/navigation";

export function BusinessPageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";

  return (
    <div key={pathname} className="business-page-enter flex-1 min-h-0">
      {children}
    </div>
  );
}

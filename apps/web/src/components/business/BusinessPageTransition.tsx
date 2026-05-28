"use client";

import { useEffectivePathname } from "@/lib/use-effective-pathname";

export function BusinessPageTransition({ children }: { children: React.ReactNode }) {
  const pathname = useEffectivePathname();

  return (
    <div key={pathname} className="business-page-enter flex-1 min-h-0">
      {children}
    </div>
  );
}

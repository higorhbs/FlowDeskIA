"use client";

export function BusinessPageTransition({ children }: { children: React.ReactNode }) {
  return <div className="business-page-enter flex-1 min-h-0">{children}</div>;
}

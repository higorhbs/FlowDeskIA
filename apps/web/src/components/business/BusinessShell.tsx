"use client";

import { useParams } from "next/navigation";
import { BusinessHeader } from "./BusinessHeader";

export function BusinessShell({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  return (
    <div className="flex flex-col min-h-full">
      <BusinessHeader businessId={id} />
      {children}
    </div>
  );
}

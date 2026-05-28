"use client";

import NextLink, { type LinkProps } from "next/link";
import type { ComponentProps } from "react";
import { hostingHref, isFirebaseHostingClient } from "@/lib/hosting-href";

type AppLinkProps = LinkProps & Omit<ComponentProps<"a">, "href">;

function toHref(href: LinkProps["href"]): string {
  if (typeof href === "string") return href;
  const path = href.pathname ?? "/";
  const query = href.query;
  if (!query || typeof query !== "object") return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v != null) params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export function AppLink({ href, prefetch, replace, scroll, ...rest }: AppLinkProps) {
  const path = hostingHref(toHref(href));

  if (isFirebaseHostingClient()) {
    return <a href={path} {...rest} />;
  }

  return (
    <NextLink href={href} prefetch={prefetch} replace={replace} scroll={scroll} {...rest} />
  );
}

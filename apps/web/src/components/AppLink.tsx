"use client";

import NextLink, { type LinkProps } from "next/link";
import type { ComponentProps } from "react";

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

function useHardDocumentNav() {
  return (
    typeof window !== "undefined" &&
    process.env.NODE_ENV === "production" &&
    !window.location.hostname.includes("localhost")
  );
}

export function AppLink({ href, prefetch, replace, scroll, ...rest }: AppLinkProps) {
  const hard = useHardDocumentNav();
  if (hard) {
    return <a href={toHref(href)} {...rest} />;
  }
  return <NextLink href={href} prefetch={prefetch} replace={replace} scroll={scroll} {...rest} />;
}

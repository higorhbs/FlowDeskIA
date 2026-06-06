"use client";

import NextLink, { type LinkProps } from "next/link";
import type { ComponentProps } from "react";

type AppLinkProps = LinkProps & Omit<ComponentProps<"a">, "href">;

export function AppLink({ href, prefetch, replace, scroll, onClick, ...rest }: AppLinkProps) {
  return (
    <NextLink href={href} prefetch={prefetch} replace={replace} scroll={scroll} onClick={onClick} {...rest} />
  );
}

function normPath(path: string): string {
  return (path.split("?")[0] ?? path).replace(/\/$/, "") || "/";
}

export function isActivePanelRoute(pathname: string, href: string): boolean {
  const p = normPath(pathname);
  const h = normPath(href);
  return p === h || p.startsWith(`${h}/`);
}

export function panelHref(businessId: string, segment: string): string {
  return `/businesses/${businessId}/${segment}`;
}

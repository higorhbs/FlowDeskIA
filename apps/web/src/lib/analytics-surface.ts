const APP_PREFIXES = ["/businesses", "/dashboard", "/plan", "/profile"] as const;

export function isAppDashboardRoute(pathname: string) {
  return APP_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isMarketingRoute(pathname: string) {
  return !isAppDashboardRoute(pathname);
}

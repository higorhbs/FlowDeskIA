export function normalizeAppPath(path: string) {
  const base = path.split("?")[0]?.replace(/\/$/, "") ?? "";
  return base || "/";
}

export const MOBILE_PUBLIC_PATHS = new Set(["/", "/landing", "/terms", "/privacy"]);

export const MOBILE_SETUP_PATHS = new Set([
  "/dashboard",
  "/businesses",
  "/businesses/new",
  "/profile",
  "/plan",
]);

export function isMobilePublicPath(path: string) {
  return MOBILE_PUBLIC_PATHS.has(normalizeAppPath(path));
}

export function isMobileSetupPath(path: string) {
  return MOBILE_SETUP_PATHS.has(normalizeAppPath(path));
}

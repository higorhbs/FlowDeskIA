import type { BusinessType } from "@zapflow/shared";

type BusinessSnapshot = { id: string; type: BusinessType };
type BusinessRow = { id: string; type?: BusinessType };

export const HOSTING_PLACEHOLDER_BUSINESS_ID = "app";
const ID_KEY = "zapflow:activeBusinessId";
const TYPE_KEY = "zapflow:activeBusinessType";

export function pathBusinessSegment(pathname: string): string | undefined {
  const id = pathname.match(/\/businesses\/([^/]+)/)?.[1];
  if (!id || id === "new") return undefined;
  return id;
}

export function inBusinessArea(pathname: string): boolean {
  return /\/businesses\/[^/]+/.test(pathname);
}

export function readStoredBusinessId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const id = sessionStorage.getItem(ID_KEY);
    return id && id !== HOSTING_PLACEHOLDER_BUSINESS_ID ? id : null;
  } catch {
    return null;
  }
}

export function readStoredBusinessType(): BusinessType | null {
  if (typeof window === "undefined") return null;
  try {
    const t = sessionStorage.getItem(TYPE_KEY);
    return t ? (t as BusinessType) : null;
  } catch {
    return null;
  }
}

export function persistBusinessSnapshot(business: BusinessSnapshot) {
  if (typeof window === "undefined" || !business.id || business.id === HOSTING_PLACEHOLDER_BUSINESS_ID) return;
  try {
    sessionStorage.setItem(ID_KEY, business.id);
    if (business.type) sessionStorage.setItem(TYPE_KEY, business.type);
  } catch {
    /* ignore */
  }
}

export function persistBusinessId(id: string) {
  if (typeof window === "undefined" || !id || id === HOSTING_PLACEHOLDER_BUSINESS_ID) return;
  try {
    sessionStorage.setItem(ID_KEY, id);
  } catch {
    /* ignore */
  }
}

export function resolveBusinessId(
  pathname: string,
  businesses: BusinessRow[] | undefined
): string {
  const segment = pathBusinessSegment(pathname);
  const stored = readStoredBusinessId();
  const tenant = businesses?.[0];

  if (segment && segment !== HOSTING_PLACEHOLDER_BUSINESS_ID) return segment;
  if (stored) return stored;
  if (tenant?.id) return tenant.id;
  return segment ?? "";
}

export function resolveBusinessType(
  businessId: string,
  business: BusinessRow | null | undefined,
  businesses: BusinessRow[] | undefined
): BusinessType | undefined {
  const stored = readStoredBusinessType();
  if (stored) return stored;
  if (business?.type) return business.type;
  const match = businesses?.find((b) => b.id === businessId);
  if (match?.type) return match.type;
  return businesses?.[0]?.type;
}

export function catalogPathForBusiness(businessId: string): string {
  return `/businesses/${businessId}/catalog`;
}

export function fixPlaceholderBusinessPath(pathname: string, realId: string): string | null {
  if (!pathname.includes(`/businesses/${HOSTING_PLACEHOLDER_BUSINESS_ID}`)) return null;
  return pathname.replace(`/businesses/${HOSTING_PLACEHOLDER_BUSINESS_ID}`, `/businesses/${realId}`);
}

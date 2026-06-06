import { cache } from "react";
import { getAnalytics, listBusinesses } from "@flowdesk/firebase";
import type { Business } from "@flowdesk/firebase/client";
import { requireServerSession } from "@/lib/server/auth";

export type DashboardAnalytics = Awaited<ReturnType<typeof getAnalytics>>;

export type DashboardData = {
  business: Business | null;
  analytics: DashboardAnalytics | null;
};

export async function loadDashboardData(uid: string): Promise<DashboardData> {
  const businesses = await listBusinesses(uid);
  const business = [...businesses].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
  if (!business) return { business: null, analytics: null };

  try {
    const analytics = await getAnalytics(business.id);
    return { business, analytics };
  } catch {
    return { business, analytics: null };
  }
}

export const getCachedDashboardData = cache(async (): Promise<DashboardData> => {
  const uid = await requireServerSession();
  return loadDashboardData(uid);
});

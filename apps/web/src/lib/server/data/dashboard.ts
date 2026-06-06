import { cache } from "react";
import type { Business } from "@flowdesk/firebase/client";
import { requireServerSession } from "@/lib/server/auth";
import { getPrimaryBusiness } from "@/lib/server/services/businesses";
import { getAnalyticsForUser } from "@/lib/server/services/analytics";

export type DashboardAnalytics = Awaited<ReturnType<typeof getAnalyticsForUser>>;

export type DashboardData = {
  business: Business | null;
  analytics: DashboardAnalytics | null;
};

export async function loadDashboardData(uid: string): Promise<DashboardData> {
  const business = await getPrimaryBusiness(uid);
  if (!business) return { business: null, analytics: null };

  try {
    const analytics = await getAnalyticsForUser(uid, business.id);
    return { business, analytics };
  } catch {
    return { business, analytics: null };
  }
}

export const getCachedDashboardData = cache(async (): Promise<DashboardData> => {
  const uid = await requireServerSession();
  return loadDashboardData(uid);
});

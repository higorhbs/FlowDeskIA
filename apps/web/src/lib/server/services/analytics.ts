import { unstable_cache } from "next/cache";
import { getAnalytics } from "@flowdesk/firebase";
import { assertBusinessOwned } from "./business-access";

const getAnalyticsCached = unstable_cache(
  async (businessId: string) => getAnalytics(businessId),
  ["analytics-v2"],
  { revalidate: 30 }
);

type AnalyticsOptions = { trusted?: boolean };

export async function getAnalyticsForUser(
  uid: string,
  businessId: string,
  opts?: AnalyticsOptions
) {
  if (!opts?.trusted) await assertBusinessOwned(uid, businessId);
  return getAnalyticsCached(businessId);
}

import { requireServerSession } from "@/lib/server/auth";
import { getPrimaryBusiness } from "@/lib/server/services/businesses";
import { getTenantForUser } from "@/lib/server/services/tenants";
import { BusinessesPageClient } from "@/components/business/BusinessesPageClient";

export const dynamic = "force-dynamic";

export default async function BusinessesPage() {
  const uid = await requireServerSession();
  const [tenant, business] = await Promise.all([
    getTenantForUser(uid),
    getPrimaryBusiness(uid),
  ]);

  return <BusinessesPageClient tenant={tenant} business={business} />;
}

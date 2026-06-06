import { Suspense } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { DashboardActions } from "@/components/dashboard/DashboardActions";
import { DashboardContentSkeleton } from "@/components/dashboard/DashboardContentSkeleton";
import { DashboardEmptyContent } from "@/components/dashboard/DashboardEmptyState";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { getCachedDashboardData } from "@/lib/server/data/dashboard";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

async function DashboardPageAction() {
  const { business } = await getCachedDashboardData();
  if (!business) return null;
  return <DashboardActions businessId={business.id} />;
}

async function DashboardContent() {
  const { business, analytics } = await getCachedDashboardData();
  if (!business) return <DashboardEmptyContent />;
  return <DashboardView business={business} analytics={analytics} />;
}

export default function DashboardPage() {
  return (
    <PageLayout
      title="Dashboard"
      description="Visão geral de conversas, agendamentos e receita do seu negócio."
      action={
        <Suspense
          fallback={
            <div className="flex items-center gap-2">
              <Skeleton className="size-9 shrink-0 rounded-xl" />
              <Skeleton className="h-9 w-36 rounded-xl" />
            </div>
          }
        >
          <DashboardPageAction />
        </Suspense>
      }
      className="max-w-none w-full"
    >
      <Suspense fallback={<DashboardContentSkeleton />}>
        <DashboardContent />
      </Suspense>
    </PageLayout>
  );
}

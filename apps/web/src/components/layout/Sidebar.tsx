import { Suspense } from "react";
import { MessageSquare } from "lucide-react";
import { APP_DISPLAY_NAME, getBusinessVocabulary } from "@flowdesk/shared";
import { getServerSession } from "@/lib/server/auth";
import { getTenantForUser } from "@/lib/server/services/tenants";
import { planAllowsPix } from "@/lib/plan-features";
import { loadSidebarContext } from "@/lib/server/data/sidebar";
import { SidebarBusinessCard } from "@/components/layout/SidebarBusinessCard";
import { SidebarBusinessCardSkeleton } from "@/components/layout/SidebarBusinessCardSkeleton";
import { SidebarConversationsBadge } from "@/components/layout/SidebarConversationsBadge";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { SidebarFooter } from "@/components/layout/SidebarFooter";

export async function Sidebar() {
  const session = await getServerSession();
  if (!session) return null;

  const [{ business }, tenant] = await Promise.all([
    loadSidebarContext(session.uid),
    getTenantForUser(session.uid),
  ]);

  const businessId = business?.id;
  const vocabulary = getBusinessVocabulary(business?.type);
  const pixEnabled = planAllowsPix(tenant?.plan);

  return (
    <aside className="hidden lg:flex sticky top-0 z-30 w-64 shrink-0 self-start h-dvh max-h-dvh flex-col overflow-hidden bg-white border-r border-gray-200">
      <div className="shrink-0 flex items-center gap-2 px-5 py-4 border-b border-gray-100">
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-gray-900">{APP_DISPLAY_NAME}</span>
      </div>

      {businessId && (
        <Suspense fallback={<SidebarBusinessCardSkeleton />}>
          <SidebarBusinessCard uid={session.uid} businessId={businessId} />
        </Suspense>
      )}

      <SidebarNav
        businessId={businessId}
        vocabulary={vocabulary}
        pixEnabled={pixEnabled}
        conversationsBadge={
          businessId ? (
            <Suspense
              fallback={
                <span className="ml-auto size-[18px] shrink-0 rounded-full bg-gray-200 animate-pulse" aria-hidden />
              }
            >
              <SidebarConversationsBadge uid={session.uid} businessId={businessId} />
            </Suspense>
          ) : undefined
        }
      />

      <SidebarFooter hasBusiness={!!businessId} />
    </aside>
  );
}

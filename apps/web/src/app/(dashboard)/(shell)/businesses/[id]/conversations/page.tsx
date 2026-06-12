import { Suspense } from "react";
import { ConversationsContentSkeleton } from "@/components/conversations/ConversationsContentSkeleton";
import { ConversationsPanel } from "@/components/conversations/ConversationsPanel";
import { ConversationsView } from "@/components/conversations/ConversationsView";
import { getCachedConversationsData } from "@/lib/server/data/conversations";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ c?: string }>;
};

async function ConversationsContent({
  businessId,
  selectedId,
}: {
  businessId: string;
  selectedId?: string;
}) {
  const { business, list, selected, selectedError } = await getCachedConversationsData(
    businessId,
    selectedId,
  );
  return (
    <ConversationsView
      businessId={businessId}
      business={business}
      initialList={list}
      initialSelected={selected}
      initialSelectedError={selectedError}
    />
  );
}

export default async function ConversationsPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { c } = await searchParams;

  return (
    <div className="flex h-[calc(100dvh-5rem)] max-h-[calc(100dvh-5rem)] flex-col overflow-hidden p-4 sm:p-6 lg:h-dvh lg:max-h-dvh lg:p-8">
      <div className="mb-4 shrink-0 space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">Conversas</h1>
        <p className="text-sm leading-relaxed text-gray-500">Atendimentos e mensagens do WhatsApp.</p>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <Suspense
          fallback={
            <ConversationsPanel>
              <ConversationsContentSkeleton />
            </ConversationsPanel>
          }
        >
          <ConversationsPanel>
            <ConversationsContent businessId={id} selectedId={c} />
          </ConversationsPanel>
        </Suspense>
      </div>
    </div>
  );
}

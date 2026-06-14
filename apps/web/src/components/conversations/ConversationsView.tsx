"use client";

import { useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Business, Conversation, Message } from "@flowdesk/firebase/client";
import { toast } from "sonner";
import { businessApi, conversationApi, whatsappApi } from "@/lib/api";
import { useAppRouter } from "@/lib/app-navigation";
import type { ConversationDetail } from "@/lib/server/data/conversations";
import { ConversationList } from "./ConversationList";
import { ConversationThread } from "./ConversationThread";
import { sendDest } from "./conversation-utils";

type ConversationsViewProps = {
  businessId: string;
  business: Business;
  initialList: { conversations: Conversation[]; total: number };
  initialSelected: ConversationDetail | null;
  initialSelectedError: boolean;
};

export function ConversationsView({
  businessId,
  business: initialBusiness,
  initialList,
  initialSelected,
  initialSelectedError,
}: ConversationsViewProps) {

  const router = useAppRouter();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("c");
  const queryClient = useQueryClient();

  const { data: listData } = useQuery({
    queryKey: ["conversations", businessId],
    queryFn: () => conversationApi.list(businessId, { page: 1 }),
    initialData: initialList,
    refetchInterval: 10_000,
  });

  const { data: resolvedBusiness = initialBusiness } = useQuery({
    queryKey: ["business", businessId],
    queryFn: () => businessApi.get(businessId),
    initialData: initialBusiness,
  });

  const {
    data: detail,
    isFetching: detailLoading,
    isError: detailError,
    refetch: refetchDetail,
  } = useQuery({
    queryKey: ["conversation-detail", businessId, selectedId],
    queryFn: () => (selectedId ? conversationApi.get(businessId, selectedId) : null),
    enabled: !!selectedId,
    initialData:
      selectedId && initialSelected?.id === selectedId
        ? initialSelected
        : undefined,
    initialDataUpdatedAt: selectedId && initialSelected?.id === selectedId ? Date.now() : undefined,
    refetchInterval: selectedId ? 5_000 : false,
  });

  const detailErrorState =
    !!selectedId && (detailError || (initialSelectedError && !detail && !detailLoading));

  const selectConversation = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("c", id);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const clearSelection = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("c");
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  function refreshSidebar() {
    router.refresh();
  }

  function appendMessageToDetail(message: Message) {
    if (!selectedId) return;
    queryClient.setQueryData(
      ["conversation-detail", businessId, selectedId],
      (old: ConversationDetail | null | undefined) => {
        if (!old) return old;
        if (old.messages.some((m) => m.id === message.id)) return old;
        return { ...old, messages: [...old.messages, message] };
      },
    );
    void queryClient.invalidateQueries({ queryKey: ["conversation-detail", businessId, selectedId] });
    void queryClient.invalidateQueries({ queryKey: ["conversations", businessId] });
  }

  function invalidateConversationQueries(convId?: string | null) {
    void queryClient.invalidateQueries({ queryKey: ["conversations", businessId] });
    void queryClient.invalidateQueries({ queryKey: ["conversation-detail", businessId, convId ?? selectedId] });
    refreshSidebar();
  }

  const attendMutation = useMutation({
    mutationFn: (convId: string) => conversationApi.attend(businessId, convId),
    onSuccess: () => {
      invalidateConversationQueries();
      toast.success("Atendimento assumido — a IA pausou para esta conversa.");
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (convId: string) => conversationApi.release(businessId, convId),
    onSuccess: () => {
      invalidateConversationQueries();
      toast.success("IA reativada para esta conversa.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (convId: string) => conversationApi.remove(businessId, convId),
    onSuccess: (_data, convId) => {
      if (selectedId === convId) clearSelection();
      void queryClient.invalidateQueries({ queryKey: ["conversations", businessId] });
      void queryClient.removeQueries({ queryKey: ["conversation-detail", businessId, convId] });
      refreshSidebar();
      toast.success("Conversa excluída.");
    },
    onError: (err: Error) => toast.error(err.message ?? "Erro ao excluir conversa"),
  });

  const sendMutation = useMutation({
    mutationFn: ({
      to,
      text,
      conversationId,
    }: {
      to: string;
      text: string;
      conversationId: string;
    }) => whatsappApi.send(businessId, to, text, conversationId),
    onSuccess: (data: { message?: Message }) => {
      if (data?.message) appendMessageToDetail(data.message);
      refreshSidebar();
    },
    onError: (err: Error) => toast.error(err.message ?? "Erro ao enviar mensagem"),
  });

  const sendMediaMutation = useMutation({
    mutationFn: ({
      conversationId,
      file,
      caption,
    }: {
      conversationId: string;
      file: File;
      caption?: string;
    }) => whatsappApi.sendMedia(businessId, conversationId, file, caption),
    onSuccess: (data: { message?: Message }) => {
      if (data?.message) appendMessageToDetail(data.message);
      refreshSidebar();
    },
    onError: (err: Error) => toast.error(err.message ?? "Erro ao enviar mídia"),
  });

  const isSending = sendMutation.isPending || sendMediaMutation.isPending;
  const conversations: Conversation[] = listData?.conversations ?? [];
  const selectedConv = detail as ConversationDetail | null | undefined;

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      <ConversationList
        conversations={conversations}
        selectedId={selectedId}
        onSelect={selectConversation}
      />
      <ConversationThread
        business={resolvedBusiness}
        businessId={businessId}
        selectedId={selectedId}
        conversation={selectedConv}
        detailLoading={detailLoading && !selectedConv}
        detailError={detailErrorState}
        onRefetchDetail={() => void refetchDetail()}
        onAttend={(convId) => attendMutation.mutate(convId)}
        onRelease={(convId) => releaseMutation.mutate(convId)}
        onDelete={(convId) => deleteMutation.mutate(convId)}
        attendPending={attendMutation.isPending}
        releasePending={releaseMutation.isPending}
        deletePending={deleteMutation.isPending}
        onSendText={(conv, text) =>
          sendMutation.mutate({ to: sendDest(conv), text, conversationId: conv.id })
        }
        onSendMedia={(conv, file, caption) =>
          sendMediaMutation.mutate({ conversationId: conv.id, file, caption })
        }
        isSending={isSending}
      />
    </div>
  );
}

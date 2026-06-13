"use client";

import { useState } from "react";
import type { Conversation } from "@flowdesk/firebase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ConversationStatusBadge } from "@/components/conversations/ConversationStatusBadge";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { formatCustomerLabel, cn } from "@/lib/utils";

type ConversationListProps = {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
}: ConversationListProps) {
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput, 250);
  const filtered = conversations.filter((c) => {
    const label = formatCustomerLabel(
      c.customerPhone,
      c.customerName,
    ).toLowerCase();
    return (
      label.includes(search.toLowerCase()) || c.customerPhone.includes(search)
    );
  });

  return (
    <div className="flex h-full min-h-0 w-72 shrink-0 flex-col overflow-hidden border-r border-gray-200 sm:w-80">
      <div className="flex h-16 shrink-0 items-center border-b border-gray-200 bg-white px-4">
        <div className="relative w-full min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            className="w-full pl-9 text-sm"
            placeholder="Buscar cliente..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            Nenhuma conversa
          </div>
        ) : (
          filtered.map((conv) => (
            <button
              key={conv.id}
              type="button"
              onClick={() => onSelect(conv.id)}
              className={cn(
                "flex w-full items-start border-b border-gray-50 px-4 py-4 text-left transition-colors hover:bg-gray-50",
                selectedId === conv.id && "border-brand-100 bg-brand-50",
              )}
            >
              <div className="flex w-full min-w-0 items-start justify-between gap-3">
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-left text-sm font-medium text-gray-900">
                    {formatCustomerLabel(conv.customerPhone, conv.customerName)}
                  </p>
                  {!conv.customerName && conv.customerPhone.includes("@lid") ? (
                    <p className="truncate text-left text-xs text-gray-400">
                      WhatsApp
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <ConversationStatusBadge status={conv.status} className="text-xs" />
                  <p className="whitespace-nowrap text-xs text-gray-400">
                    {formatDistanceToNow(new Date(conv.lastMessageAt), {
                      locale: ptBR,
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

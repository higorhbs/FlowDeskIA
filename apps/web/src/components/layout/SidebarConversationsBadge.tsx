import { cn } from "@/lib/utils";
import { loadSidebarOpenConversationsCount } from "@/lib/server/data/sidebar";

type Props = {
  uid: string;
  businessId: string;
};

export async function SidebarConversationsBadge({ uid, businessId }: Props) {
  const count = await loadSidebarOpenConversationsCount(uid, businessId);
  if (count <= 0) return null;

  return (
    <span
      className={cn(
        "ml-auto inline-flex shrink-0 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold leading-none text-white tabular-nums",
        count > 9 ? "h-[18px] min-w-[22px] px-1" : "size-[18px]",
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

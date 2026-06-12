import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function ListRowSkeleton() {
  return (
    <div className="flex w-full items-start gap-3 border-b border-gray-50 px-4 py-4">
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-3 w-14" />
      </div>
    </div>
  );
}

function BubbleSkeleton({ align }: { align: "left" | "right" }) {
  return (
    <div className={cn("flex", align === "left" ? "justify-start" : "justify-end")}>
      <Skeleton
        className={cn(
          "h-16 rounded-2xl",
          align === "left" ? "w-48 rounded-tl-sm" : "w-56 rounded-tr-sm",
        )}
      />
    </div>
  );
}

export function ConversationsContentSkeleton() {
  return (
    <>
      <div className="flex h-full min-h-0 w-72 shrink-0 flex-col overflow-hidden border-r border-gray-200 sm:w-80">
        <div className="shrink-0 border-b border-gray-100 p-4">
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ListRowSkeleton />
          <ListRowSkeleton />
          <ListRowSkeleton />
          <ListRowSkeleton />
          <ListRowSkeleton />
          <ListRowSkeleton />
        </div>
      </div>
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-gray-50">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <Skeleton className="h-5 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-7 w-28 rounded-md" />
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-6">
          <BubbleSkeleton align="left" />
          <BubbleSkeleton align="right" />
          <BubbleSkeleton align="left" />
          <BubbleSkeleton align="right" />
        </div>
        <div className="shrink-0 border-t border-gray-200 bg-white p-4">
          <Skeleton className="mb-3 h-9 w-full rounded-md" />
          <div className="flex gap-2">
            <Skeleton className="size-10 shrink-0 rounded-md" />
            <Skeleton className="h-20 flex-1 rounded-md" />
            <Skeleton className="size-10 shrink-0 rounded-md" />
          </div>
        </div>
      </div>
    </>
  );
}

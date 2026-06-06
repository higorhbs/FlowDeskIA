export function SidebarBusinessCardSkeleton() {
  return (
    <div className="shrink-0 mx-3 mt-3 mb-1 rounded-xl bg-brand-50 border border-brand-100 p-3 animate-pulse">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-brand-200/80 flex-shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3.5 bg-brand-200/80 rounded w-3/4" />
          <div className="h-3 bg-brand-200/60 rounded w-1/2" />
        </div>
      </div>
      <div className="mt-3 pt-2.5 border-t border-brand-100">
        <div className="h-10 rounded-lg bg-white/80 border border-brand-100" />
      </div>
    </div>
  );
}

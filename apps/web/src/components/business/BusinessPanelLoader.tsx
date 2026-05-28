export function BusinessPanelLoader() {
  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto animate-pulse" aria-busy aria-label="Carregando">
      <div className="h-28 rounded-3xl bg-gray-200/80 mb-8" />
      <div className="space-y-3">
        <div className="h-4 w-2/5 rounded-lg bg-gray-200/80" />
        <div className="h-4 w-3/5 rounded-lg bg-gray-200/70" />
        <div className="h-32 rounded-2xl bg-gray-100 mt-6" />
      </div>
    </div>
  );
}

export default function DashboardPlainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 overflow-auto" style={{ scrollbarGutter: "stable" }}>
      <div className="mx-auto w-full max-w-[90rem] min-w-0 min-h-screen">{children}</div>
    </div>
  );
}

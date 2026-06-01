import { MobileDesktopPrompt } from "@/components/layout/MobileDesktopPrompt";

export function DesktopOnlyGate({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="md:hidden fixed inset-0 z-[200] overflow-y-auto overscroll-none">
        <MobileDesktopPrompt />
      </div>
      <div className="hidden md:block min-h-screen">{children}</div>
    </>
  );
}

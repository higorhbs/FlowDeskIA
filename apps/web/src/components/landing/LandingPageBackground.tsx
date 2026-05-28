import { ChatBackground } from "@/components/landing/ChatBackground";

export function LandingPageBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <div className="absolute -left-40 top-0 size-[28rem] rounded-full bg-white/90 blur-3xl" />
      <div className="absolute -right-32 top-24 size-96 rounded-full bg-white/80 blur-3xl" />
      <div className="absolute bottom-20 left-1/4 size-80 rounded-full bg-white/70 blur-3xl" />
      <div className="absolute right-1/3 top-1/2 size-64 rounded-full bg-gray-100/50 blur-3xl" />
      <ChatBackground />
    </div>
  );
}

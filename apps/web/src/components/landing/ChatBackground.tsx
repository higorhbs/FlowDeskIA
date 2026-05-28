type ChatEmoji = {
  emoji: string;
  position: string;
  size: string;
  opacity: string;
  tx: string;
  ty: string;
  dur: string;
  delay: string;
  rotate: string;
};

const CHAT_EMOJIS: ChatEmoji[] = [
  { emoji: "🤖", position: "top-[6%] left-[4%]", size: "text-6xl", opacity: "opacity-[0.18]", tx: "22px", ty: "-30px", dur: "5.5s", delay: "0s", rotate: "-8deg" },
  { emoji: "💬", position: "top-[8%] right-[5%]", size: "text-5xl", opacity: "opacity-[0.16]", tx: "-20px", ty: "-26px", dur: "6.2s", delay: "0.8s", rotate: "5deg" },
  { emoji: "📩", position: "top-[22%] left-[14%]", size: "text-4xl", opacity: "opacity-[0.15]", tx: "12px", ty: "-28px", dur: "7.2s", delay: "1.6s", rotate: "4deg" },
  { emoji: "🔔", position: "top-[28%] right-[10%]", size: "text-4xl", opacity: "opacity-[0.14]", tx: "-14px", ty: "-32px", dur: "6.5s", delay: "1.8s", rotate: "0deg" },
  { emoji: "📱", position: "top-[48%] left-[3%]", size: "text-5xl", opacity: "opacity-[0.2]", tx: "18px", ty: "-22px", dur: "5s", delay: "1.4s", rotate: "0deg" },
  { emoji: "⚡", position: "top-[42%] right-[4%]", size: "text-6xl", opacity: "opacity-[0.17]", tx: "-24px", ty: "-20px", dur: "6.8s", delay: "0.3s", rotate: "10deg" },
  { emoji: "💚", position: "bottom-[38%] left-[10%]", size: "text-5xl", opacity: "opacity-[0.16]", tx: "20px", ty: "-16px", dur: "6s", delay: "0.2s", rotate: "-12deg" },
  { emoji: "✅", position: "bottom-[14%] left-[6%]", size: "text-6xl", opacity: "opacity-[0.15]", tx: "16px", ty: "-18px", dur: "7s", delay: "1.1s", rotate: "6deg" },
  { emoji: "📅", position: "bottom-[10%] right-[8%]", size: "text-5xl", opacity: "opacity-[0.18]", tx: "-18px", ty: "-24px", dur: "5.8s", delay: "0.5s", rotate: "-5deg" },
];

export function ChatBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 hidden sm:block"
      aria-hidden
    >
      {CHAT_EMOJIS.map((item) => (
        <div
          key={item.position}
          className={`chat-bg-emoji absolute select-none leading-none ${item.position} ${item.size} ${item.opacity}`}
          style={
            {
              "--chat-tx": item.tx,
              "--chat-ty": item.ty,
              "--chat-dur": item.dur,
              "--chat-delay": item.delay,
              "--chat-rotate": item.rotate,
            } as React.CSSProperties
          }
        >
          <span role="img" aria-hidden>
            {item.emoji}
          </span>
        </div>
      ))}
    </div>
  );
}

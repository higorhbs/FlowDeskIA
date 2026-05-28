const MSG_POINTS = "4,28 16,20 28,24 40,14 52,18 64,8 76,12";
const BAR_HEIGHTS = [38, 62, 44, 56, 32, 48];

export function HeroAreaChart() {
  return (
    <svg viewBox="0 0 80 32" className="h-9 w-full" aria-hidden>
      <defs>
        <linearGradient id="heroAreaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
        </linearGradient>
      </defs>
      <polygon points={`${MSG_POINTS} 76,32 4,32`} fill="url(#heroAreaFill)" />
      <polyline
        points={MSG_POINTS}
        fill="none"
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HeroBarChart() {
  return (
    <svg viewBox="0 0 72 28" className="h-7 w-full" aria-hidden>
      {BAR_HEIGHTS.map((h, i) => (
        <rect
          key={i}
          x={i * 12 + 2}
          y={28 - h * 0.4}
          width={8}
          height={h * 0.4}
          rx={2}
          fill="rgba(255,255,255,0.92)"
        />
      ))}
    </svg>
  );
}

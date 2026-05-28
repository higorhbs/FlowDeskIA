import { cn } from "@/lib/utils";

type HeroGlassCardProps = {
  className?: string;
  children: React.ReactNode;
};

export function HeroGlassCard({ className, children }: HeroGlassCardProps) {
  return (
    <div className={cn("hero-glass px-4 py-3", className)}>
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}

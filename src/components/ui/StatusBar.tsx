import { cn } from "@/lib/utils";

interface StatusBarProps {
  label: string;
  current: number;
  max: number;
  color: "hp" | "mp" | "spirit";
  icon?: string;
  className?: string;
}

const colorMap = {
  hp: {
    bar: "from-cinnabar-700 via-cinnabar-500 to-cinnabar-400",
    text: "text-cinnabar-400",
    glow: "rgba(168, 50, 50, 0.5)",
  },
  mp: {
    bar: "from-pine-700 via-jade-500 to-pine-400",
    text: "text-jade-400",
    glow: "rgba(90, 138, 114, 0.5)",
  },
  spirit: {
    bar: "from-gold-600 via-gold-400 to-gold-300",
    text: "text-gold-400",
    glow: "rgba(201, 169, 97, 0.5)",
  },
};

export function StatusBar({ label, current, max, color, icon, className }: StatusBarProps) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const c = colorMap[color];
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex items-center gap-1.5 w-20 shrink-0">
        {icon && <span className="text-base">{icon}</span>}
        <span className={cn("font-serif text-xs", c.text)}>{label}</span>
      </div>
      <div className="flex-1 h-4 bg-ink-900/80 rounded-sm border border-ink-600/60 overflow-hidden relative">
        <div
          className={cn("h-full bg-gradient-to-b transition-all duration-500", c.bar)}
          style={{
            width: `${pct}%`,
            boxShadow: `0 0 12px ${c.glow}`,
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-number text-[10px] text-paper-50 text-shadow-ink">
            {current} / {max}
          </span>
        </div>
      </div>
    </div>
  );
}

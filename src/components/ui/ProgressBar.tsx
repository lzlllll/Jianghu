import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max: number;
  className?: string;
  barClassName?: string;
  showText?: boolean;
  height?: number;
}

export function ProgressBar({
  value,
  max,
  className,
  barClassName,
  showText,
  height = 8,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className={cn(
        "relative w-full bg-ink-900/80 rounded-sm border border-ink-600/50 overflow-hidden",
        className,
      )}
      style={{ height }}
    >
      <div
        className={cn(
          "h-full bg-gradient-to-r from-gold-600 to-gold-400 transition-all duration-500",
          barClassName,
        )}
        style={{ width: `${pct}%` }}
      />
      {showText && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-number text-[9px] text-paper-50 text-shadow-ink">
            {value} / {max}
          </span>
        </div>
      )}
    </div>
  );
}

import { cn } from "@/lib/utils";

interface ProficiencyRingProps {
  value: number;
  max: number;
  size?: number;
  className?: string;
  label?: string;
}

export function ProficiencyRing({
  value,
  max,
  size = 80,
  className,
  label,
}: ProficiencyRingProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(74, 63, 53, 0.4)"
          strokeWidth="4"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c9a961" />
            <stop offset="100%" stopColor="#a83232" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-number text-base text-gold-400">{pct.toFixed(0)}%</span>
        {label && <span className="text-[9px] text-paper-400/60">{label}</span>}
      </div>
    </div>
  );
}

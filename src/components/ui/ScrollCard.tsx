import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ScrollCardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  ornament?: ReactNode;
}

export function ScrollCard({ children, className, title, subtitle, ornament }: ScrollCardProps) {
  return (
    <div className={cn("scroll-card rounded-lg p-5 relative", className)}>
      {(title || ornament) && (
        <div className="flex items-center justify-between mb-3">
          <div>
            {title && (
              <h3 className="font-brush text-xl text-paper-100 text-shadow-ink tracking-wider">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-paper-400/70 mt-0.5">{subtitle}</p>
            )}
          </div>
          {ornament}
        </div>
      )}
      {children}
    </div>
  );
}

import { cn } from "@/lib/utils";

interface PanelTitleProps {
  title: string;
  poem?: string;
  className?: string;
}

export function PanelTitle({ title, poem, className }: PanelTitleProps) {
  return (
    <div className={cn("mb-6", className)}>
      <div className="flex items-baseline gap-4">
        <h2 className="font-brush text-4xl text-gold-400 text-shadow-ink tracking-widest">
          {title}
        </h2>
        <div className="flex-1 h-px cloud-divider" />
      </div>
      {poem && (
        <p className="font-serif text-sm text-paper-400/60 mt-2 italic tracking-wide">
          {poem}
        </p>
      )}
    </div>
  );
}

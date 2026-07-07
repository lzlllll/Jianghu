import { cn } from "@/lib/utils";

interface CloudDividerProps {
  className?: string;
  label?: string;
}

export function CloudDivider({ className, label }: CloudDividerProps) {
  if (!label) {
    return <div className={cn("cloud-divider my-4", className)} />;
  }
  return (
    <div className={cn("flex items-center gap-3 my-4", className)}>
      <div className="flex-1 cloud-divider" />
      <span className="font-brush text-gold-400/70 text-sm tracking-widest">
        {label}
      </span>
      <div className="flex-1 cloud-divider" />
    </div>
  );
}

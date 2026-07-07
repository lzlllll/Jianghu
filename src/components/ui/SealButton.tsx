import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SealButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "seal" | "ghost";
  children: ReactNode;
}

export function SealButton({
  variant = "seal",
  className,
  children,
  ...props
}: SealButtonProps) {
  return (
    <button
      className={cn(
        "px-4 py-2 rounded text-sm transition-all duration-200 select-none",
        variant === "seal" ? "seal-btn" : "ghost-btn",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

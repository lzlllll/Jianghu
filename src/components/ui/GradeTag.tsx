import { cn } from "@/lib/utils";
import type { ItemGrade } from "@/data/types";

interface GradeTagProps {
  grade: ItemGrade;
  className?: string;
}

const gradeStyle: Record<ItemGrade, string> = {
  凡品: "border-paper-400/40 text-paper-300 bg-paper-400/10",
  灵品: "border-jade-500/50 text-jade-400 bg-jade-500/10",
  玄品: "border-cinnabar-500/50 text-cinnabar-400 bg-cinnabar-500/10",
  天品: "border-gold-400/60 text-gold-400 bg-gold-400/10",
  仙品: "border-gold-300/80 text-gold-300 bg-gold-300/15",
};

export function GradeTag({ grade, className }: GradeTagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-sm border text-[10px] font-serif tracking-wider",
        gradeStyle[grade],
        className,
      )}
    >
      {grade}
    </span>
  );
}

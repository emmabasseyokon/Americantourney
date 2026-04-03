import { cn } from "@/lib/utils/cn";
import type { Classification } from "@/types/database";

const classificationColors: Record<Classification, string> = {
  "A+": "bg-amber-100 text-amber-800 border-amber-300",
  A: "bg-blue-100 text-blue-800 border-blue-300",
  "B+": "bg-green-100 text-green-800 border-green-300",
  B: "bg-teal-100 text-teal-800 border-teal-300",
  "C+": "bg-orange-100 text-orange-800 border-orange-300",
  C: "bg-gray-100 text-gray-800 border-gray-300",
};

interface BadgeProps {
  classification: Classification;
  className?: string;
}

export function Badge({ classification, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
        classificationColors[classification],
        className
      )}
    >
      {classification}
    </span>
  );
}

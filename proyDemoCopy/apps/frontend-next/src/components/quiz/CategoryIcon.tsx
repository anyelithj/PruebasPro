import type { Category } from "@/types/quiz";
import { categoryEmoji } from "@/lib/categories";
// [Atom CategoryIcon]: emoji por categoria | [Patron]: Atomic Design | [Principio]: SRP | [Principio]: DRY (delega al SSOT)

export function CategoryIcon({
  category,
  className,
}: {
  category: Category;
  className?: string;
}) {
  return (
    <span className={className} role="img" aria-label={category}>
      {categoryEmoji(category)}
    </span>
  );
}

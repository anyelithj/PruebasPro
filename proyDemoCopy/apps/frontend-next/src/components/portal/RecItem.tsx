import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function RecItem({
  icon: Icon,
  iconNode,
  title,
  subtitle,
  iconClassName,
}: {
  icon?: LucideIcon;
  iconNode?: React.ReactNode;
  title: string;
  subtitle: string;
  iconClassName?: string;
}) {
  return (
    <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-muted transition-colors hover:bg-gradient-soft">
      <div
        className={cn(
          "grid place-items-center size-10 rounded-xl bg-gradient-brand text-white shrink-0 font-bold",
          iconClassName,
        )}
      >
        {Icon ? <Icon className="size-4" strokeWidth={2} /> : iconNode}
      </div>
      <div className="flex-1">
        <b className="block text-sm">{title}</b>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </div>
    </div>
  );
}

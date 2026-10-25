import { cn } from "@/lib/utils";

type Tone = "default" | "success" | "amber" | "red" | "gray";

const toneClass: Record<Tone, string> = {
  default: "bg-gradient-soft text-primary",
  success: "bg-tone-brand-soft text-tone-brand",
  amber: "bg-tone-warning-soft text-tone-warning",
  red: "bg-tone-danger-soft text-tone-danger",
  gray: "bg-muted text-muted-foreground",
};

export function Tag({
  children,
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

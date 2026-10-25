import { cn } from "@/lib/utils";
// [crb · CourseBadge]: pill semántico para tipo curso / tag | [Patrón]: Atomic Design (atom) + Value Object visual | [Principio]: SRP + OCP

export interface CourseBadgeProps {
  text: string;
  // [color]: HEX brand del grupo o eje — pintamos borde+fondo con alpha derivado | [Patrón]: Theming por instancia
  color?: string;
  size?: "sm" | "md";
  // [as]: role visual ("status" = estado del usuario, "tag" = taxonomía) | [Principio]: ISP
  as?: "status" | "tag";
  className?: string;
}

// [Helper alpha]: deriva fondo/borde tintado a partir del HEX | [Principio]: DRY
function tinted(color: string, alpha: string): string {
  return `${color}${alpha}`;
}

export function CourseBadge({
  text,
  color = "#1B7EC8",
  size = "sm",
  as = "tag",
  className,
}: CourseBadgeProps) {
  const padding = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs";
  return (
    <span
      role={as === "status" ? "status" : undefined}
      className={cn(
        "inline-flex items-center rounded-full font-semibold whitespace-nowrap",
        padding,
        className,
      )}
      style={{
        background: tinted(color, "22"),
        border: `1px solid ${tinted(color, "44")}`,
        color,
      }}
    >
      {text}
    </span>
  );
}

// cn.ts => une clases de Tailwind condicionales sin librerías (reemplaza clsx con una función pura de una línea).
// cn("px-2", activo && "bg-brand", undefined) -> "px-2 bg-brand"
export const cn = (...classes: Array<string | false | null | undefined>): string => classes.filter(Boolean).join(" ");

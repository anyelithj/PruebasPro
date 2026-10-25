import * as React from "react";
import { cn } from "@/lib/utils";
// [Componente Input]: primitive accesible | [Patrón]: Atomic Design (atom) | [Principio]: SRP + LSP | [Paradigma]: Funcional + JSX

// [Props]: extiende input nativo para que `aria-*`, `name`, `type`, etc. funcionen sin envolver | [Principio]: LSP
export type InputProps = React.ComponentProps<"input">; // `type` alias (TS): mismo contrato sin interfaz vacía (regla no-empty-object-type)

// [Estilos]: focus ring + estados invalid (aria-invalid) | [Buena práctica]: WCAG 2.1 AA
// [Estilos]: utilidad `control` del sistema de diseño (misma forma/tono que select, textarea y buscadores) | [Principio]: DRY + SSOT
const baseClasses = [
  "control flex w-full",
  "file:border-0 file:bg-transparent file:text-sm file:font-medium",
].join(" ");

// [forwardRef]: necesario para integraciones (RHF, Radix) | [Patrón]: Forwarding Ref
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(baseClasses, className)}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };

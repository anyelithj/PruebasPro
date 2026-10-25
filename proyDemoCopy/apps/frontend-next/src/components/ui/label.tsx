"use client";
import * as React from "react";
import { Label as LabelPrimitive } from "radix-ui"; // [Sprint 7.19 · una librería por función]: paquete unificado radix-ui (canónico)
import { cn } from "@/lib/utils";
// [Componente Label]: wrapper Radix con foco accesible | [Patrón]: Atomic Design (atom) | [Principio]: SRP | [Paradigma]: Funcional + JSX

// [markRequired · 2026-10-19]: «Título *» → el asterisco final se pinta en rojo (.req) en TODOS los formularios sin tocar cada etiqueta | [Principio]: DRY + OCP
// `aria-hidden`: el asterisco es visual; el campo ya anuncia `required` al lector de pantalla
function markRequired(children: React.ReactNode): React.ReactNode {
  const kids = React.Children.toArray(children); // `Children.toArray` (React): aplana fragmentos y textos sueltos
  const last = kids.at(-1); // `at(-1)` (ES2022): último hijo
  if (typeof last !== "string" || !last.trimEnd().endsWith("*")) return children;
  kids[kids.length - 1] = (
    <React.Fragment key="req">
      {last.trimEnd().slice(0, -1)}
      <span className="req" aria-hidden="true">
        *
      </span>
    </React.Fragment>
  );
  return kids;
}

// [forwardRef]: para integraciones con formularios | [Patrón]: Forwarding Ref
const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "text-sm font-semibold leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className,
    )}
    {...props}
  >
    {markRequired(children)}
  </LabelPrimitive.Root>
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };

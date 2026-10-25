"use client"; // [Next.js]: Client Component → estado de apertura y eventos del documento
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
// [Dropdown]: botón + panel flotante reutilizable (tema, idioma, notificaciones, carrito, perfil) | [Patrón]: Compound/Render Props (children recibe `close`) + Observer (eventos del DOM) | [Principio]: DRY + SRP | [Paradigma]: Funcional + Reactivo
// [A11y]: aria-expanded/aria-controls en el disparador, cierre con Escape y con clic fuera (WAI-ARIA APG "disclosure / menu button")

export interface DropdownProps {
  label: string; // Nombre accesible del disparador
  trigger: ReactNode; // Contenido visible del botón
  triggerClassName?: string;
  panelClassName?: string;
  panelRole?: "menu" | "dialog"; // "menu" = lista de opciones · "dialog" = panel con contenido (notificaciones, carrito)
  onOpen?: () => void; // Hook al abrir (p. ej. cargar notificaciones)
  badge?: ReactNode; // Globo (contador) superpuesto al disparador
  children: (close: () => void) => ReactNode; // Render prop: el contenido puede cerrar el panel
}

export function Dropdown({ label, trigger, triggerClassName, panelClassName, panelRole = "menu", onOpen, badge, children }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId(); // `useId` (React 18+): id estable en servidor y cliente

  // [Cerrar con clic fuera / Escape]: listeners solo mientras está abierto | cleanup en el return (sin fugas)
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open) onOpen?.(); // `?.()` (ES2020): llama solo si existe
    setOpen((v) => !v);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup={panelRole}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label}
        title={label}
        className={cn(
          "relative flex items-center gap-1.5 rounded-full border border-border bg-muted text-xs font-semibold text-foreground transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          triggerClassName ?? "px-2.5 py-1.5",
        )}
      >
        {trigger}
        {badge}
      </button>
      {open && (
        <div
          id={panelId}
          role={panelRole}
          aria-label={label}
          className={cn("absolute right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg", panelClassName ?? "min-w-40 py-1")}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

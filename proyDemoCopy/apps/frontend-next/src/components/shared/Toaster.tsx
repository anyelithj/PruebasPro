"use client"; // [Next.js]: Client Component → escucha eventos del navegador
import { Check, Info, TriangleAlert, X } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis)
import { useEffect, useState } from "react";
import { usePreferences } from "@/components/layout/PreferencesProvider";
// [Toaster · 2026-10-19]: avisos breves «Registro guardado / editado / eliminado» del shell Next.js | [Patrón]: Observer (evento `aula:toast` en window, el MISMO que publica Angular) | [Principio]: SRP + DIP | [Paradigma]: Reactivo (React state)
// [Uso]: `toast("success", "…")` desde cualquier Client Component o un Angular Element embebido (<aula-exportar>, <aula-guia-widget>)
// [A11y]: role="status" (éxito) / role="alert" (error) · botón cerrar con nombre · no roba el foco · animación solo con motion-safe

export type ToastKind = "success" | "error" | "warning" | "info"; // [2026-10-23]: + warning
interface Shown {
  id: number;
  kind: ToastKind;
  message: string;
  ms: number; // Tiempo en pantalla (la barra inferior se vacía en ese tiempo)
}

// [ICONS]: icono por tipo | `Record` (TS) → no se olvida ningún tipo | [Patrón]: Lookup Table
const ICONS: Record<ToastKind, typeof Check> = { success: Check, error: TriangleAlert, warning: TriangleAlert, info: Info };

// [toast]: publica el aviso; lo pinta el Toaster montado en el layout del portal | `CustomEvent` (DOM)
export function toast(kind: ToastKind, message: string): void {
  window.dispatchEvent(new CustomEvent("aula:toast", { detail: { kind, message } }));
}

let seq = 0; // Ids únicos de los avisos en esta pestaña

export function Toaster() {
  const { t } = usePreferences();
  const [items, setItems] = useState<Shown[]>([]);

  useEffect(() => {
    const dismiss = (id: number) => setItems((l) => l.filter((x) => x.id !== id));
    const onToast = (e: Event) => {
      const d = (e as CustomEvent<{ kind?: ToastKind; message?: string }>).detail;
      if (!d?.message) return;
      const id = ++seq;
      const ms = d.kind === "error" ? 7000 : 4000; // Los errores se leen con más calma
      setItems((l) => [...l.slice(-3), { id, kind: d.kind ?? "info", message: d.message!, ms }]); // Máximo 4 a la vez
      setTimeout(() => dismiss(id), ms);
    };
    window.addEventListener("aula:toast", onToast);
    return () => window.removeEventListener("aula:toast", onToast); // Sin fugas al desmontar
  }, []);

  return (
    <ol aria-label={t.common.notifications} className="pointer-events-none fixed bottom-20 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
      {items.map((x) => {
        const Icon = ICONS[x.kind];
        return (
          // [2026-10-23]: diseño `.toast` de globals.css (el mismo que <aula-toaster> de Angular) · `--toast-ms` sincroniza la barra con el cierre
          <li key={x.id} role={x.kind === "error" ? "alert" : "status"} data-kind={x.kind} className="toast" style={{ "--toast-ms": `${x.ms}ms` } as React.CSSProperties}>
            <span className="toast-icon" aria-hidden>
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="toast-title">{t.common.toastTitle[x.kind]}</strong>
              <span className="toast-msg">{x.message}</span>
            </span>
            <button type="button" className="toast-close" aria-label={t.common.close} onClick={() => setItems((l) => l.filter((y) => y.id !== x.id))}>
              <X aria-hidden className="size-4" />
            </button>
            <span className="toast-bar" aria-hidden />
          </li>
        );
      })}
    </ol>
  );
}

"use client";
import { useEffect, useState } from "react";
import { LoadingSpinner } from "./LoadingSpinner";
// [BusyOverlay · 2026-11-16]: capa con el MISMO indicador de carga (LoadingSpinner, «Cargando… puede tardar unos minutos») mientras se crea, edita o elimina algo
// Detecta Server Actions (cabecera `Next-Action`) y escrituras al BFF (/api/*, método ≠ GET) envolviendo `window.fetch` una vez | [Patrón]: Decorator (fetch) + Observer
// Fuera (no bloquean la pantalla): lector, traducción, IA, juego, progreso… — mismo criterio que el notifyInterceptor de Angular | [Principio]: OCP (formularios nuevos sin código extra)
// ponytail: parche global de fetch; si algún día molesta, pasar a un contexto explícito con useTransition

const NOT_CRUD = /\/(speech|auth|events|ai|lookup|translate|attempts|rounds|turn|turns|draft|review|ask|chat|writing-corrections|nonce|verify|checkout-session|end|finish|practice|progress|reindex|ipa|enrich|align|export|tx|orders|payments|flashcards|study-plan|fluency|conversations|sessions|extract-text|import-url|complete|topics-done)(\/|$|\?)/;

let inFlight = 0;
const listeners = new Set<(n: number) => void>();
const emit = () => listeners.forEach((l) => l(inFlight));

function isWrite(input: RequestInfo | URL, init?: RequestInit): boolean {
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  if (headers.has("Next-Action")) return true; // Server Action (alta/edición/borrado desde un <form action>)
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const url = new URL(input instanceof Request ? input.url : String(input), location.href);
  return method !== "GET" && method !== "HEAD" && url.origin === location.origin && url.pathname.startsWith("/api/") && !NOT_CRUD.test(url.pathname);
}

function patchFetch() {
  const w = window as typeof window & { __aulaBusyPatched?: boolean };
  if (w.__aulaBusyPatched) return; // Una sola vez (HMR / varios montajes)
  w.__aulaBusyPatched = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    if (!isWrite(input, init)) return original(input, init);
    inFlight++;
    emit();
    try {
      return await original(input, init);
    } finally {
      inFlight = Math.max(0, inFlight - 1); // `finally`: baja también si falla → nunca queda colgado
      emit();
    }
  };
}

export function BusyOverlay() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    patchFetch();
    listeners.add(setCount);
    return () => void listeners.delete(setCount);
  }, []);
  if (!count) return null;
  return (
    // [A11y]: LoadingSpinner ya lleva role="status" + aria-live · la capa bloquea clics → sin envíos dobles
    <div className="fixed inset-0 z-[60] grid place-items-center bg-background/60 backdrop-blur-[1px]">
      {/* [2026-11-16]: sin caja blanca → solo el spinner y el texto sobre la capa difuminada */}
      <LoadingSpinner className="min-h-0 py-8" />
    </div>
  );
}

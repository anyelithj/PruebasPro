"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";
// [Hook useLocalStorage]: estado persistido en `window.localStorage`, sincronizado entre pestañas | [Patrón]: Custom Hook + Observer (store externo) | [Principio]: SRP + SSOT
// [SSR]: `getServerSnapshot` devuelve null → servidor y primer render del cliente usan `initial` (sin "hydration mismatch") | [Paradigma]: Reactivo
// [Fix]: antes leía localStorage en el lazy init (mismatch al hidratar) y rehidrataba con setState dentro de un efecto (render en cascada, regla react-hooks/set-state-in-effect)

type Updater<T> = T | ((prev: T) => T);

const SAME_TAB_EVENT = "local-storage"; // `storage` solo avisa a OTRAS pestañas; este evento avisa a la actual
const memory = new Map<string, string | null>(); // [Fallback en memoria]: si localStorage lanza (modo privado, cuota), el estado sigue funcionando en la sesión

// [readRaw]: string crudo guardado (o null) | `has` primero: una escritura fallida vive en memoria
function readRaw(key: string): string | null {
  if (memory.has(key)) return memory.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // [Defensive]: storage bloqueado → como si no hubiera valor
  }
}

// [writeRaw]: persiste (o borra con null) y notifica | [Patrón]: Command + Observer
function writeRaw(key: string, raw: string | null): void {
  try {
    if (raw === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, raw);
    memory.delete(key);
  } catch {
    memory.set(key, raw); // [Quota / disabled storage]: el valor sigue válido en memoria
  }
  window.dispatchEvent(new Event(SAME_TAB_EVENT));
}

// [parse]: JSON → T con fallback | JSON inválido → valor inicial
function parse<T>(raw: string | null, initial: T): T {
  if (raw === null) return initial;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return initial;
  }
}

// [subscribe]: firma de useSyncExternalStore; escucha otras pestañas (`storage`) y la actual (evento propio)
function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(SAME_TAB_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SAME_TAB_EVENT, onChange);
  };
}

export function useLocalStorage<T>(
  key: string,
  initial: T,
): [T, (value: Updater<T>) => void, () => void] {
  // `useSyncExternalStore` (React 18+): el snapshot es el STRING crudo → comparación estable sin re-renders infinitos
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => null, // Servidor: sin storage → `initial`
  );
  // `useMemo` (React): solo re-parsea si cambió el string o el inicial
  const value = useMemo(() => parse(raw, initial), [raw, initial]);

  const update = useCallback(
    (next: Updater<T>) => {
      const prev = parse(readRaw(key), initial); // Lee el valor vigente (no uno obsoleto del closure)
      const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      writeRaw(key, JSON.stringify(resolved));
    },
    [key, initial],
  );

  const remove = useCallback(() => writeRaw(key, null), [key]);

  return [value, update, remove];
}

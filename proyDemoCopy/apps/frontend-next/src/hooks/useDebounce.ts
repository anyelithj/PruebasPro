"use client";
import { useEffect, useState } from "react";
// [Hook useDebounce]: difiere actualización de un valor hasta que pasa `delayMs` sin cambios | [Patrón]: Custom Hook | [Principio]: SRP | [Paradigma]: Reactivo

export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    // [Timer]: agenda commit del valor; cualquier cambio antes del vencimiento lo cancela
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}

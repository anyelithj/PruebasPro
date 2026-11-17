// [scrollIntoBox · Presentación · Lectura · 2026-10-28]: desplaza SOLO la columna con scroll propio (`[data-reading-scroll]`) para que la frase quede a la vista,
// sin mover la ventana → las dos columnas (original y traducción) pueden seguir la lectura A LA VEZ | [Patrón]: Helper DOM sin estado | [Principio]: SRP + DRY (lo usan ambas columnas)
// [A11y]: `prefers-reduced-motion: reduce` → salto inmediato (`auto`) en vez de animación (`smooth`) | [Tecnología]: `matchMedia` + `getBoundingClientRect` + `scrollTo` (Web APIs)

// [prefersReducedMotion]: preferencia del sistema operativo | `?.`: entornos sin `matchMedia` (SSR, tests)
export const prefersReducedMotion = (): boolean => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

// [scrollIntoBox]: si `el` está fuera de la zona visible de su columna, la columna se desplaza para dejarlo a ~1/3 de la altura (contexto antes y después)
export function scrollIntoBox(el: HTMLElement | null): void {
  const box = el?.closest<HTMLElement>('[data-reading-scroll]'); // `closest` (DOM): contenedor con scroll más cercano
  if (!el || !box) return;
  const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
  // Sin scroll propio (contenido más corto que la caja) → nada que hacer
  if (box.scrollHeight <= box.clientHeight) return;
  const boxRect = box.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const top = r.top - boxRect.top; // Posición de la frase relativa a la parte visible de la columna
  const margin = 16; // px de holgura: la frase no queda pegada al borde
  if (top >= margin && top + r.height <= box.clientHeight - margin) return; // Ya visible
  box.scrollTo({ top: box.scrollTop + top - box.clientHeight / 3, behavior });
}

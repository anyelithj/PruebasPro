// vitals.ts (PerformanceObserver nativo) => RF-24.8 Core Web Vitals sin librerías (0 KB extra):
//   LCP (pintado del elemento más grande), CLS (desplazamientos inesperados), INP (interacción más lenta),
//   TTFB (primer byte) y carga completa. Se reportan UNA vez por página al ocultarla (visibilitychange).
// Patrón Observer (PerformanceObserver) + Buffer. Paradigma funcional (describeTarget es pura).

export interface Vitals {
  lcp: number;
  cls: number;
  inp: number;
  ttfb: number;
  load: number;
}

// observeVitals => mide en segundo plano y entrega los valores al ocultar la pestaña
export function observeVitals(report: (vitals: Vitals) => void): void {
  if (typeof PerformanceObserver === "undefined") return;
  const vitals: Vitals = { lcp: 0, cls: 0, inp: 0, ttfb: 0, load: 0 };
  // "buffered: true" => incluye las entradas ocurridas antes de crear el observador
  const observe = (type: string, onEntry: (entry: PerformanceEntry & Record<string, unknown>) => void) => {
    try {
      new PerformanceObserver((list) => list.getEntries().forEach((entry) => onEntry(entry as PerformanceEntry & Record<string, unknown>))).observe({ type, buffered: true } as PerformanceObserverInit);
    } catch {
      // Tipo no soportado por el navegador (Safari no tiene "event" ni "layout-shift"): se omite
    }
  };
  observe("largest-contentful-paint", (entry) => (vitals.lcp = Math.round(entry.startTime)));
  observe("layout-shift", (entry) => {
    if (!entry["hadRecentInput"]) vitals.cls = Math.round((vitals.cls + Number(entry["value"] ?? 0)) * 1000) / 1000;
  });
  observe("event", (entry) => (vitals.inp = Math.max(vitals.inp, Math.round(entry.duration))));
  let sent = false;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden" || sent) return;
    const [navigation] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    vitals.ttfb = Math.round(navigation?.responseStart ?? 0);
    vitals.load = Math.round(navigation?.loadEventEnd ?? 0);
    sent = true; // Una medición por carga de la página
    report(vitals);
  });
}

// describeTarget => "button.add-to-cart" / "a#buy": identifica el elemento clicado sin datos personales (función pura)
export function describeTarget(target: EventTarget | null): string {
  if (!(target instanceof Element)) return "";
  const el = target.closest("a, button, input, select, [role='button']") ?? target;
  const id = el.id ? `#${el.id}` : "";
  const cls = typeof el.className === "string" && el.className ? `.${el.className.trim().split(/\s+/)[0]}` : "";
  return `${el.tagName.toLowerCase()}${id || cls}`.slice(0, 60);
}

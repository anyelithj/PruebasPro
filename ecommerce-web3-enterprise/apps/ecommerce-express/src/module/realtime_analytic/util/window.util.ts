// window.util.ts (TypeScript puro) => funciones de "windowing" para analítica de alta frecuencia:
// tumbling (ventanas fijas sin solape), sliding (la última ventana que termina "ahora") y session (agrupa por
// inactividad). Paradigma FUNCIONAL: funciones puras sin estado ni E/S => fáciles de probar y sin efectos.
// Precondición: los puntos llegan ORDENADOS por tiempo (el buffer del service es de solo-anexar).

// TimedPoint => evento mínimo para agregar: instante (epoch ms), valor y clave de agrupación de sesión
export interface TimedPoint {
  readonly at: number;
  readonly value: number;
  readonly sessionKey: string;
}

// Summary => agregados estadísticos de un conjunto de valores
export interface Summary {
  readonly count: number;
  readonly sum: number;
  readonly avg: number;
  readonly p50: number;
  readonly p95: number;
  readonly p99: number;
}

// lowerBound => búsqueda binaria O(log n): primer índice con "at >= time" (evita recorrer todo el buffer)
export function lowerBound(points: readonly TimedPoint[], time: number): number {
  let low = 0;
  let high = points.length;
  while (low < high) {
    const mid = (low + high) >>> 1; // ">>> 1" => división entera entre 2 sin desbordes
    if ((points[mid]?.at ?? Infinity) < time) low = mid + 1;
    else high = mid;
  }
  return low;
}

// sliding => puntos dentro de (now - sizeMs, now]: la ventana "deslizante" que siempre termina en el presente
export function sliding<T extends TimedPoint>(points: readonly T[], sizeMs: number, now: number): T[] {
  return points.slice(lowerBound(points, now - sizeMs + 1), lowerBound(points, now + 1));
}

// tumbling => "buckets" fijos alineados al reloj (ej. cada minuto exacto) que cubren los últimos "count" periodos
export function tumbling<T extends TimedPoint>(points: readonly T[], sizeMs: number, now: number, count: number): Array<{ start: string; points: T[] }> {
  const lastStart = Math.floor(now / sizeMs) * sizeMs; // Inicio del bucket actual (alineado)
  // "Array.from({ length })" => crea los N buckets de forma declarativa, del más antiguo al actual
  return Array.from({ length: count }, (_, index) => {
    const start = lastStart - (count - 1 - index) * sizeMs;
    return { start: new Date(start).toISOString(), points: points.slice(lowerBound(points, start), lowerBound(points, start + sizeMs)) };
  });
}

// session => agrupa por sessionKey; una pausa mayor que gapMs abre una sesión nueva (ventanas de sesión)
export function session<T extends TimedPoint>(points: readonly T[], gapMs: number): Array<{ key: string; start: number; end: number; points: T[] }> {
  const open = new Map<string, { key: string; start: number; end: number; points: T[] }>();
  const closed: Array<{ key: string; start: number; end: number; points: T[] }> = [];
  for (const point of points) {
    const current = open.get(point.sessionKey);
    if (current && point.at - current.end <= gapMs) {
      current.end = point.at;
      current.points.push(point);
      continue;
    }
    if (current) closed.push(current); // Pausa larga => se cierra la sesión anterior
    open.set(point.sessionKey, { key: point.sessionKey, start: point.at, end: point.at, points: [point] });
  }
  return [...closed, ...open.values()]; // Spread => une cerradas y abiertas en un arreglo nuevo (inmutabilidad)
}

// percentile => método "nearest-rank" sobre valores YA ordenados ascendentemente
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank))] ?? 0;
}

// summarize => count/sum/avg y percentiles p50/p95/p99 (una sola ordenación por llamada)
export function summarize(values: readonly number[]): Summary {
  const sorted = [...values].sort((a, b) => a - b); // Copia antes de ordenar: no muta la entrada
  const sum = sorted.reduce((total, value) => total + value, 0);
  const round = (value: number) => Number(value.toFixed(2));
  return {
    count: sorted.length,
    sum: round(sum),
    avg: sorted.length ? round(sum / sorted.length) : 0,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}

// stats.util.ts (TypeScript puro) => estadística común a varios módulos (DRY): salud de flujos (RF-20.7) y métricas
// web p75 (RF-24.8). Paradigma funcional: función pura sin estado.

// percentile => valor del percentil p (0..1) de una lista; vacía => 0
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)]!;
}

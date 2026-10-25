// [Util periodo]: convierte un número de meses (2/3/6/12) en fecha de corte | [Patrón]: Pure Function | [Principio]: DRY | [Paradigma]: Funcional

// [Periodos permitidos]: ventana de meses soportada por los filtros de analíticas | [Principio]: SSOT
export const ALLOWED_PERIOD_MONTHS = [2, 3, 6, 12] as const;
export type PeriodMonths = (typeof ALLOWED_PERIOD_MONTHS)[number];

// [parsePeriodMonths]: valida el query param; devuelve undefined si no es un periodo soportado (= sin filtro) | [Principio]: Robustez
export function parsePeriodMonths(raw?: string): PeriodMonths | undefined {
  if (!raw) return undefined;
  const n = parseInt(raw, 10);
  return (ALLOWED_PERIOD_MONTHS as readonly number[]).includes(n)
    ? (n as PeriodMonths)
    : undefined;
}

// [monthsToSince]: fecha de corte = ahora menos N meses; undefined → sin corte (todo el histórico) | [Patrón]: Time Window
export function monthsToSince(months?: number): Date | undefined {
  if (!months || months <= 0) return undefined;
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  return since;
}

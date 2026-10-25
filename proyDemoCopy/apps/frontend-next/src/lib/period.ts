// [Util periodo frontend]: valida el query param ?period= contra los meses soportados | [Patrón]: Pure Function | [Principio]: DRY + SSOT (espeja backend ALLOWED_PERIOD_MONTHS)

const ALLOWED = [2, 3, 6, 12];

// [parsePeriod]: devuelve el número de meses si es válido, o undefined (= sin filtro) | [Principio]: Robustez
export function parsePeriod(raw?: string | string[]): number | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return undefined;
  const n = parseInt(value, 10);
  return ALLOWED.includes(n) ? n : undefined;
}

// [parseSection]: normaliza el query param ?section= a string o undefined | [Principio]: Robustez
export function parseSection(raw?: string | string[]): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && value.trim() ? value.trim() : undefined;
}

// [monthsToSince]: fecha de corte = ahora menos N meses; undefined → sin corte | [Patrón]: Time Window. Usado para filtrar en cliente listas ya traídas (ej. historial de sesiones) | [Principio]: DRY
export function monthsToSince(months?: number): Date | undefined {
  if (!months || months <= 0) return undefined;
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  return since;
}

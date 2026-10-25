// format.ts (Intl nativo) => formato de moneda, números y fechas por idioma. Los formateadores se CACHEAN por clave
// (crear un Intl.NumberFormat es costoso): patrón Flyweight + funciones puras. Sin dayjs: 0 KB extra.
const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();

function formatter<T extends Intl.NumberFormat | Intl.DateTimeFormat>(key: string, create: () => T): T {
  if (!cache.has(key)) cache.set(key, create());
  return cache.get(key) as T;
}

const intlLocale = (locale: string) => (locale === "en" ? "en-US" : "es-CO");

// formatMoney => centavos -> "$ 125.000" (el dinero se guarda en la unidad mínima: sin errores de coma flotante)
export function formatMoney(cents: number, currency = "COP", locale = "es"): string {
  const digits = currency === "COP" ? 0 : 2;
  return formatter(`m:${locale}:${currency}`, () => new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency, maximumFractionDigits: digits, minimumFractionDigits: digits })).format(cents / 100);
}

export function formatDate(value: string | Date, locale = "es"): string {
  return formatter(`d:${locale}`, () => new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium" })).format(new Date(value));
}

export function formatDateTime(value: string | Date, locale = "es"): string {
  return formatter(`dt:${locale}`, () => new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium", timeStyle: "short" })).format(new Date(value));
}

// formatNumber => 12500 -> "12.500" (métricas)
export function formatNumber(value: number, locale = "es"): string {
  return formatter(`n:${locale}`, () => new Intl.NumberFormat(intlLocale(locale))).format(value);
}

// formatPercent => 0.1234 -> "12,3 %"
export function formatPercent(value: number, locale = "es"): string {
  return formatter(`p:${locale}`, () => new Intl.NumberFormat(intlLocale(locale), { style: "percent", maximumFractionDigits: 1 })).format(value);
}

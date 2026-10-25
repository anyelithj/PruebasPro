// attribution.model.ts (TypeScript puro) => RF-22.9 / RF-24.11 atribución multitoque del marketing: reparte el valor
// de cada compra entre los canales que el cliente tocó antes (30 días). Modelos:
//   FIRST_CLICK (100 % al primero) · LAST_CLICK (100 % al último) · LINEAR (partes iguales)
//   TIME_DECAY (más peso a lo reciente: vida media 7 días) · POSITION_BASED (40 % primero, 40 % último, 20 % el medio)
// Paradigma: funcional (funciones puras). Patrón Strategy (un repartidor por modelo, elegido por tabla).

export const ATTRIBUTION_MODELS = ["FIRST_CLICK", "LAST_CLICK", "LINEAR", "TIME_DECAY", "POSITION_BASED"] as const;
export type AttributionModel = (typeof ATTRIBUTION_MODELS)[number];

export interface Touchpoint {
  channel: string;
  at: Date;
}

const HALF_LIFE_DAYS = 7;
type Weigher = (points: Touchpoint[], conversionAt: Date) => number[];

// WEIGHERS => pesos (suman 1) por posición de cada punto de contacto
const WEIGHERS: Record<AttributionModel, Weigher> = {
  FIRST_CLICK: (points) => points.map((_, i) => (i === 0 ? 1 : 0)),
  LAST_CLICK: (points) => points.map((_, i) => (i === points.length - 1 ? 1 : 0)),
  LINEAR: (points) => points.map(() => 1 / points.length),
  TIME_DECAY: (points, conversionAt) => {
    // 2^(-días/vida media): un toque de hace 7 días pesa la mitad que uno de hoy
    const raw = points.map((point) => 2 ** (-(conversionAt.getTime() - point.at.getTime()) / 86_400_000 / HALF_LIFE_DAYS));
    const total = raw.reduce((a, b) => a + b, 0);
    return raw.map((value) => value / total);
  },
  POSITION_BASED: (points) => {
    if (points.length === 1) return [1];
    if (points.length === 2) return [0.5, 0.5];
    const middle = 0.2 / (points.length - 2);
    return points.map((_, i) => (i === 0 || i === points.length - 1 ? 0.4 : middle));
  },
};

// attribute => reparte "value" entre canales según el modelo (toques ordenados por fecha; sin toques => "direct")
export function attribute(touchpoints: Touchpoint[], value: number, model: AttributionModel, conversionAt: Date): Record<string, number> {
  const points = [...touchpoints].sort((a, b) => a.at.getTime() - b.at.getTime());
  if (points.length === 0) return { direct: value };
  const weights = WEIGHERS[model](points, conversionAt);
  const credit: Record<string, number> = {};
  points.forEach((point, index) => {
    credit[point.channel] = (credit[point.channel] ?? 0) + value * (weights[index] ?? 0);
  });
  return credit;
}

// mergeCredit => suma el crédito de muchas conversiones (reduce sobre objetos)
export function mergeCredit(credits: Array<Record<string, number>>): Array<{ channel: string; value: number; share: number }> {
  const totals: Record<string, number> = {};
  for (const credit of credits) for (const [channel, value] of Object.entries(credit)) totals[channel] = (totals[channel] ?? 0) + value;
  const sum = Object.values(totals).reduce((a, b) => a + b, 0);
  return Object.entries(totals)
    .map(([channel, value]) => ({ channel, value: Math.round(value), share: sum ? Number((value / sum).toFixed(4)) : 0 }))
    .sort((a, b) => b.value - a.value);
}

// ---------- RF-24.10 alertas de métricas ----------
export const ALERT_METRICS = ["REVENUE_LAST_HOUR", "ORDERS_LAST_HOUR", "CONVERSION_TODAY", "PAYMENT_FAILURES_LAST_HOUR", "CART_ABANDONMENT_TODAY", "LCP_P75_TODAY"] as const;
export type AlertMetric = (typeof ALERT_METRICS)[number];
export const breaches = (value: number, operator: "LT" | "GT", threshold: number) => (operator === "LT" ? value < threshold : value > threshold);

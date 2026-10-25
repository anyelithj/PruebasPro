// insight.model.ts (TypeScript puro + Mongoose) => inteligencia de clientes sin base de datos (funciones testeables):
//  - RF-22.2 segmentos personalizados (reglas como datos)    - RF-22.6 alto valor (CLV proyectado a 12 meses)
//  - RF-22.8 siguiente mejor acción (motor de reglas)         - RF-22.10 venta de mayor valor y anomalías de conducta
//  - RF-22.4 importación de clientes desde CSV                 - RF-22.7 matriz de retención por cohortes
// Paradigma: funcional (funciones puras) + declarativo. Patrones: Rules Engine / Chain of Responsibility (NBA),
// Strategy (cada regla de anomalía) e Interpreter (reglas de segmento -> filtros SQL en el repositorio).
import { Schema, model } from "mongoose";
import { z } from "zod";

// ---------- RF-22.2 segmentos personalizados ----------
export const SegmentRulesSchema = z
  .object({
    minOrders: z.number().int().min(0).optional(),
    maxOrders: z.number().int().min(0).optional(),
    minLtvCents: z.number().int().min(0).optional(),
    maxLtvCents: z.number().int().min(0).optional(),
    lastOrderWithinDays: z.number().int().min(1).max(3650).optional(), // Compró en los últimos N días
    noOrderForDays: z.number().int().min(1).max(3650).optional(), // No compra hace N días o más
    registeredWithinDays: z.number().int().min(1).max(3650).optional(),
    city: z.string().trim().max(80).optional(), // Ciudad de envío de algún pedido
    tags: z.array(z.string().trim().max(40)).max(10).optional(), // Etiquetas del CRM (todas)
  })
  .refine((rules) => Object.values(rules).some((value) => value !== undefined), { message: "Agrega al menos una regla" });
export type SegmentRules = z.infer<typeof SegmentRulesSchema>;

const customSegmentSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, maxlength: 80 },
    description: { type: String, default: null, maxlength: 300 },
    rules: { type: Schema.Types.Mixed, required: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true, versionKey: false }
);
export const CustomSegmentModel = model("CustomSegment", customSegmentSchema);
export const SEGMENT_PREFIX = "SEGMENT:"; // Audiencia de Marketing "SEGMENT:<id>" (DRY entre CRM y campañas)

// ---------- RF-18.8 / RF-22.6 riesgo de abandono ----------
export type ChurnRisk = "LOW" | "MEDIUM" | "HIGH";
// classifyChurn => función PURA: días sin comprar / ritmo habitual; >= 3 alto, >= 1.5 medio
export const classifyChurn = (ratio: number): ChurnRisk => (ratio >= 3 ? "HIGH" : ratio >= 1.5 ? "MEDIUM" : "LOW");

// ---------- RF-22.6 alto valor ----------
// projectedClv => valor esperado en 12 meses: ticket promedio x compras al año según su ritmo (mín. 1 compra)
export function projectedClv(orders: number, ltvCents: number, firstOrderAt: Date | null, lastOrderAt: Date | null): number {
  if (orders === 0 || !firstOrderAt || !lastOrderAt) return 0;
  const average = ltvCents / orders;
  const spanDays = Math.max(30, (lastOrderAt.getTime() - firstOrderAt.getTime()) / 86_400_000);
  const perYear = orders > 1 ? Math.min(52, (365 * (orders - 1)) / spanDays) : 1;
  return Math.round(average * perYear);
}

// ---------- RF-22.8 siguiente mejor acción ----------
export interface CustomerSignals {
  segment: "VIP" | "REGULAR" | "NEW" | "INACTIVE";
  orders: number;
  churnRisk: "LOW" | "MEDIUM" | "HIGH";
  activeCartItems: number;
  expiringPoints: number;
  birthdayInDays: number | null;
  wishlistOnSale: number;
  marketingOptIn: boolean;
}
export type NextAction = "WINBACK_COUPON" | "CART_REMINDER" | "POINTS_REMINDER" | "BIRTHDAY_OFFER" | "WISHLIST_DISCOUNT" | "SECOND_PURCHASE" | "VIP_EARLY_ACCESS" | "ASK_REVIEW" | "MARKETING_CONSENT" | "NEWSLETTER";

// RULES => primera regla que aplica gana (prioridad = orden): la acción con más impacto esperado primero
const RULES: Array<[NextAction, (s: CustomerSignals) => boolean]> = [
  ["MARKETING_CONSENT", (s) => !s.marketingOptIn && s.orders > 0], // Sin permiso no se puede hacer marketing
  ["WINBACK_COUPON", (s) => s.churnRisk === "HIGH"],
  ["CART_REMINDER", (s) => s.activeCartItems > 0],
  ["BIRTHDAY_OFFER", (s) => s.birthdayInDays !== null && s.birthdayInDays <= 7],
  ["POINTS_REMINDER", (s) => s.expiringPoints > 0],
  ["WISHLIST_DISCOUNT", (s) => s.wishlistOnSale > 0],
  ["SECOND_PURCHASE", (s) => s.orders === 1],
  ["VIP_EARLY_ACCESS", (s) => s.segment === "VIP"],
  ["ASK_REVIEW", (s) => s.orders >= 2 && s.churnRisk === "LOW"],
];
export const nextBestAction = (signals: CustomerSignals): NextAction => RULES.find(([, applies]) => applies(signals))?.[0] ?? "NEWSLETTER";

// ---------- RF-22.10 anomalías ----------
export interface BehaviorStats {
  monthlySpendCents: number[]; // Gasto de los últimos meses (el último es el mes actual)
  orders: number;
  refunds: number;
  failedPayments7d: number;
}
export type Anomaly = "SPEND_SPIKE" | "HIGH_REFUND_RATE" | "PAYMENT_FAILURES";

export function detectAnomalies(stats: BehaviorStats): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const history = stats.monthlySpendCents.slice(0, -1);
  const current = stats.monthlySpendCents.at(-1) ?? 0;
  if (history.length >= 3) {
    const mean = history.reduce((a, b) => a + b, 0) / history.length;
    const std = Math.sqrt(history.reduce((sum, value) => sum + (value - mean) ** 2, 0) / history.length);
    // z-score > 3 (o 3 veces el promedio cuando no hay variación): gasto atípico, posible fraude o reventa
    if ((std > 0 && (current - mean) / std > 3) || (std === 0 && mean > 0 && current > mean * 3)) anomalies.push("SPEND_SPIKE");
  }
  if (stats.orders >= 3 && stats.refunds / stats.orders > 0.3) anomalies.push("HIGH_REFUND_RATE");
  if (stats.failedPayments7d >= 3) anomalies.push("PAYMENT_FAILURES");
  return anomalies;
}

// ---------- RF-22.4 importación CSV ----------
export const ImportRowSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(80).default(""),
  phone: z.string().trim().max(20).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).default([]),
});
export type ImportRow = z.infer<typeof ImportRowSchema>;

// parseCustomerCsv => CSV con encabezado (email,firstName,lastName,phone,tags); tags separadas por "|".
// Admite comillas dobles con comas internas. Devuelve filas válidas y errores por línea (función PURA)
export function parseCustomerCsv(csv: string): { rows: ImportRow[]; errors: Array<{ line: number; message: string }> } {
  const lines = csv.replace(/\r/g, "").split("\n").filter((line) => line.trim());
  const split = (line: string) => [...line.matchAll(/("([^"]|"")*"|[^,]*)(,|$)/g)].slice(0, -1).map((m) => m[1]!.replace(/^"|"$/g, "").replace(/""/g, '"').trim());
  const header = split(lines[0] ?? "").map((h) => h.toLowerCase());
  const rows: ImportRow[] = [];
  const errors: Array<{ line: number; message: string }> = [];
  lines.slice(1).forEach((line, index) => {
    const cells = split(line);
    const record = Object.fromEntries(header.map((key, i) => [key, cells[i] ?? ""]));
    const parsed = ImportRowSchema.safeParse({
      email: record["email"],
      firstName: record["firstname"],
      lastName: record["lastname"],
      phone: record["phone"] || undefined,
      tags: (record["tags"] ?? "").split("|").filter(Boolean),
    });
    if (parsed.success) rows.push(parsed.data);
    else errors.push({ line: index + 2, message: parsed.error.issues[0]?.message ?? "Fila inválida" });
  });
  return { rows, errors };
}

// ---------- RF-22.7 / RF-24.2 cohortes ----------
// cohortMatrix => filas por mes de primera compra; cada celda = % de la cohorte que volvió a comprar N meses después
export function cohortMatrix(rows: Array<{ cohort: string; offset: number; customers: number }>, sizes: Map<string, number>) {
  const cohorts = [...sizes.keys()].sort();
  return cohorts.map((cohort) => {
    const size = sizes.get(cohort) ?? 0;
    const cells = rows.filter((row) => row.cohort === cohort).sort((a, b) => a.offset - b.offset);
    const maxOffset = Math.max(0, ...cells.map((cell) => cell.offset));
    const retention = Array.from({ length: maxOffset + 1 }, (_, offset) => {
      const customers = cells.find((cell) => cell.offset === offset)?.customers ?? 0;
      return size ? Math.round((customers / size) * 1000) / 1000 : 0;
    });
    return { cohort, size, retention };
  });
}

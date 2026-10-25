import { LANGUAGES, type Language } from '@aula/shared-schemas';
// [Función pura languageOrder · Dominio · Sprint 10.7 · RF-129/RF-131]: orden por defecto de las columnas (inglés, alemán, francés, portugués, ruso, chino y español AL FINAL) y operaciones inmutables para elegir y reordenar idiomas sin llamar al backend | [Patrón]: Pure Function | [Principio]: SRP + KISS (testeable sin Angular) | [Paradigma]: Funcional (cada operación devuelve un arreglo nuevo)
// [Espejo]: apps/backend/src/modules/polyglot/domain/language-order.ts aplica la misma regla en el servidor (?languages=)

export const DEFAULT_ORDER: readonly Language[] = Object.freeze([
  'en',
  'de',
  'fr',
  'pt',
  'ru',
  'zh',
  'es',
]);

const isLanguage = (v: string): v is Language => (LANGUAGES as readonly string[]).includes(v);

// [normalize]: quita inválidos y repetidos; vacío → orden por defecto (nunca una tabla sin columnas)
export function normalize(order: readonly string[]): Language[] {
  const picked = [...new Set(order.filter(isLanguage))];
  return picked.length ? picked : [...DEFAULT_ORDER];
}

// [toggle]: agrega el idioma en su posición del orden por defecto (español queda al final) o lo quita (siempre queda uno)
export function toggle(order: readonly Language[], lang: Language): Language[] {
  if (order.includes(lang)) return order.length > 1 ? order.filter((l) => l !== lang) : [...order];
  const rank = (l: Language) => DEFAULT_ORDER.indexOf(l);
  const at = order.findIndex((l) => rank(l) > rank(lang));
  return at < 0 ? [...order, lang] : [...order.slice(0, at), lang, ...order.slice(at)];
}

// [move]: sube (−1) o baja (+1) un idioma; en los bordes no cambia
export function move(order: readonly Language[], lang: Language, delta: -1 | 1): Language[] {
  const i = order.indexOf(lang);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= order.length) return [...order];
  const next = [...order];
  [next[i], next[j]] = [next[j], next[i]]; // Intercambio por desestructuración (ES2015)
  return next;
}

// [reorder]: resultado de arrastrar con CDK DragDrop (índice origen → destino)
export function reorder(order: readonly Language[], from: number, to: number): Language[] {
  const next = [...order];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, item);
  return next;
}

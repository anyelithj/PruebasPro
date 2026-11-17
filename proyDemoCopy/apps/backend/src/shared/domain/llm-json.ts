// [llm-json · Fix 2026-10-28]: lectura TOLERANTE de la salida JSON de los modelos locales (Ollama) — compartida por los borradores de Práctica y Diálogos
// [Bug que corrige]: un JSON envuelto en texto («Sure! {…}») o con una lista suelta hacía fallar el borrador entero con «La IA devolvió un borrador inválido»
// [Patrón]: Tolerant Reader | [Principio]: DRY (un solo parser para todos los borradores) + Postel | [Paradigma]: Funcional (funciones puras, sin efectos)

// [tryJson]: JSON.parse sin excepción → undefined si no es JSON | `unknown` (TS): quien llama inspecciona la forma
const tryJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined; // `catch` sin variable (ES2019): se prueba la siguiente estrategia
  }
};

// [parseJsonLoose]: 1) el texto tal cual · 2) el objeto {…} más externo · 3) la lista […] más externa | undefined si no hay JSON legible
export function parseJsonLoose(text: string): unknown {
  const between = (open: string, close: string): unknown => {
    const start = text.indexOf(open);
    const end = text.lastIndexOf(close);
    return start >= 0 && end > start ? tryJson(text.slice(start, end + 1)) : undefined;
  };
  return tryJson(text) ?? between('{', '}') ?? between('[', ']'); // `??` (ES2020): primera estrategia que funcione
}

// [listOf]: lista de elementos de la respuesta — `{"<key>": [...]}`, una lista suelta o la primera propiedad que sea una lista | [] si no hay | Función pura
export function listOf(data: unknown, key: string): unknown[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  const o = data as Record<string, unknown>;
  if (Array.isArray(o[key])) return o[key] as unknown[];
  const first = Object.values(o).find((v) => Array.isArray(v)); // p. ej. {"questions": [...]} en vez de {"items": [...]}
  return (first as unknown[] | undefined) ?? [];
}

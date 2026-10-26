// [Domain Service sanitizeTranslation · 2026-10-25]: última barrera antes de guardar o mostrar la traducción de un turno — FastAPI ya
// limpia y valida (llm_output.py + translation_rules.py), pero aquí llegan también la traducción propia del avatar y filas antiguas
// guardadas con JSON crudo: `{"I like ground meat spicy, …": "Me gusta …"}` o `["Incluye tomate, …",]` | [Patrón]: Tolerant Reader + Null Object
// (basura → null → la UI muestra «—») | [Principio]: Fail Safe + SRP (función pura sin Nest ni TypeORM) | [Paradigma]: Funcional

const TRAILING_COMMA = /,\s*([\]}])/g; // `["a",]` → `["a"]` (JSON.parse no admite la coma colgante)
const FENCE = /^```[a-z]*\s*|\s*```$/gi; // Vallas Markdown ```json … ```
const JSON_TRACE =
  /^\s*\{|^\s*\[\s*["{[\]]|^\s*"[^"]*"\s*:|"\s*:\s*"|"\s*,?\s*[\]}]\s*$/; // Huellas de JSON (no «[Estribillo] …»)
const TRANSLATION_KEYS = [
  'translation',
  'traduccion',
  'traducción',
  'target',
  'text',
  'es',
];
const MAX_DEPTH = 4; // Corta la recursión de JSON dentro de cadenas dentro de JSON…

// [norm]: minúsculas, sin tildes ni signos → comparar origen y traducción | `normalize('NFD')` + `\p{M}` (ES2018): separa y quita tildes
const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const looksLikeJson = (text: string): boolean => JSON_TRACE.test(text);

// [parseLenient]: JSON.parse tolerante (vallas + coma colgante); undefined si no es JSON
function parseLenient(raw: string): unknown {
  const text = raw.replace(FENCE, '').trim();
  for (const candidate of [text, text.replace(TRAILING_COMMA, '$1')]) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // Siguiente candidato
    }
  }
  return undefined;
}

// [unwrap]: dict → clave «translation» / clave = texto origen / único valor; lista → elementos unidos; texto con JSON → se parsea
function unwrap(raw: unknown, source: string, depth: number): string | null {
  if (raw == null || depth > MAX_DEPTH) return null;
  if (typeof raw === 'number') return String(raw);
  if (Array.isArray(raw)) {
    const parts = raw
      .map((x) => unwrap(x, source, depth + 1))
      .filter((x): x is string => !!x);
    return parts.length ? parts.join(' ') : null;
  }
  if (typeof raw === 'object') {
    const entries = Object.entries(raw as Record<string, unknown>); // `Object.entries` (ES2017): pares [clave, valor]
    const byKey =
      entries.find(([k]) => TRANSLATION_KEYS.includes(k.toLowerCase())) ??
      entries.find(([k]) => source && norm(k) === source) ??
      (entries.length === 1 ? entries[0] : undefined);
    return byKey ? unwrap(byKey[1], source, depth + 1) : null;
  }
  if (typeof raw !== 'string') return null;
  const text = raw.replace(FENCE, '').trim();
  if (text.startsWith('{') || text.startsWith('[')) {
    const parsed = parseLenient(text);
    return parsed === undefined ? text : unwrap(parsed, source, depth + 1);
  }
  return text;
}

// [sanitizeTranslation]: traducción limpia o null (vacía, JSON, o igual al original salvo nombres propios: «yes» → «yes» no sirve)
export function sanitizeTranslation(
  sourceText: string,
  translation: string | null | undefined,
): string | null {
  if (!translation?.trim()) return null;
  const value = unwrap(translation, norm(sourceText), 0);
  const text = value
    ?.replace(/\s+/g, ' ')
    .replace(/^["«“](.*)["»”]$/u, '$1')
    .trim(); // Comillas que envuelven todo el texto
  if (!text || looksLikeJson(text)) return null;
  const properNoun = sourceText
    .split(/\s+/)
    .every((w) => /^[\p{Lu}\d]/u.test(w)); // «Mexico City» → «Mexico City» sí vale
  return norm(text) === norm(sourceText) && !properNoun ? null : text;
}

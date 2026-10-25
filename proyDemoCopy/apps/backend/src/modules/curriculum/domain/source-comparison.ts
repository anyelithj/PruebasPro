import { headline } from './headline';
import { CurriculumItemKind } from './value-objects/curriculum-item-kind.vo';
// [Comparación entre fuentes · Etapa 4 de la especificación MCER]: alinea recursos que describen el mismo elemento y detecta CONTRADICCION_DETECTADA | [Patrón]: Specification (una regla por campo comparable) | [Principio]: Deterministic-first (sin LLM) + OCP (nuevo campo = nueva especificación) | [Paradigma]: Funcional (funciones puras)

// [Bandera de la especificación]: se guarda en curriculum_items.flags
export const CONTRADICTION_FLAG = 'CONTRADICCION_DETECTADA';

// [Recurso comparable]: lo mínimo que la comparación necesita (ISP: no depende de TypeORM)
export interface ComparableItem {
  id: string;
  key: string;
  source: string | null; // Nombre de la fuente (texto libre)
  sourceId: string | null; // Fuente del catálogo
  content: Record<string, unknown>;
}

// [Especificación de campo]: qué valor comparar y en qué ámbito (la IPA solo se compara dentro de la MISMA variante regional)
interface FieldSpec {
  field: string; // Nombre legible del campo en conflicto
  read: (c: Record<string, unknown>) => string | undefined;
  scope?: (c: Record<string, unknown>) => string | undefined; // p. ej. en-GB vs en-US: no se contradicen
  alternatives?: boolean; // true: "madre / mamá" son sinónimos válidos → hay contradicción solo si no comparten ninguno
}

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v : undefined; // `typeof` (JS): guard de tipo
const ipaOf = (c: Record<string, unknown>) =>
  c.ipa as { value?: string; variant?: string } | undefined;
const ipaSpec: FieldSpec = {
  field: 'ipa',
  read: (c) => str(ipaOf(c)?.value),
  scope: (c) => str(ipaOf(c)?.variant),
};

// [Registro tipo → especificaciones]: `Partial<Record<...>>` (TS) → los tipos sin campos comparables (ejercicio, rúbrica) no se comparan | [Patrón]: Registry
const SPECS: Partial<Record<CurriculumItemKind, ReadonlyArray<FieldSpec>>> = {
  [CurriculumItemKind.VOCABULARY]: [
    {
      field: 'translationEs',
      read: (c) => str(c.translationEs),
      alternatives: true,
    },
    { field: 'gender', read: (c) => str(c.gender) },
    { field: 'partOfSpeech', read: (c) => str(c.partOfSpeech) },
    ipaSpec,
  ],
  [CurriculumItemKind.PRONUNCIATION]: [ipaSpec],
  [CurriculumItemKind.TRANSLATION]: [
    { field: 'targetEs', read: (c) => str(c.targetEs), alternatives: true },
  ],
  [CurriculumItemKind.EXAMPLE]: [
    {
      field: 'translationEs',
      read: (c) => str(c.translationEs),
      alternatives: true,
    },
  ],
  [CurriculumItemKind.GRAMMAR_RULE]: [
    { field: 'structure', read: (c) => str(c.structure) },
  ],
  [CurriculumItemKind.COMMON_ERROR]: [
    { field: 'correct', read: (c) => str(c.correct), alternatives: true },
  ],
};

// [Tipos comparables]: los que tienen al menos una especificación
export const COMPARABLE_KINDS = Object.keys(SPECS) as CurriculumItemKind[];

// [normalize]: minúsculas, sin tildes, sin signos de IPA ni puntuación → "/ˈmʌðə/" y "[ˈmʌðə]" son iguales | `normalize('NFD')` (ES2015) separa tildes
const normalize = (v: string): string =>
  v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[/[\]().,;:!¡?¿"'ˈˌ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// [alternativesOf]: "madre, mamá / mami" → {madre, mama, mami} | `Set` (ES2015)
const alternativesOf = (v: string, split: boolean): Set<string> =>
  new Set((split ? v.split(/[,;/|]/) : [v]).map(normalize).filter(Boolean));

// [originOf]: de qué fuente viene el recurso → dos recursos de la MISMA fuente no se contradicen entre sí (son duplicados)
export const originOf = (
  i: Pick<ComparableItem, 'source' | 'sourceId'>,
): string => i.sourceId ?? i.source?.trim().toLowerCase() ?? 'sin-fuente';

// [Contradicción]: mismo elemento, mismo campo, valores incompatibles entre fuentes distintas
export interface Contradiction {
  headline: string;
  field: string;
  items: Array<{ id: string; key: string; origin: string; value: string }>;
}

// [findContradictions]: agrupa por titular (alineación) y aplica cada especificación entre fuentes distintas | `Map` (ES2015)
export function findContradictions(
  kind: CurriculumItemKind,
  items: ReadonlyArray<ComparableItem>,
): Contradiction[] {
  const specs = SPECS[kind] ?? [];
  const groups = new Map<string, ComparableItem[]>();
  for (const i of items)
    groups.set(headline(i.content), [
      ...(groups.get(headline(i.content)) ?? []),
      i,
    ]);

  const out: Contradiction[] = [];
  for (const [h, group] of groups) {
    if (new Set(group.map(originOf)).size < 2) continue; // Una sola fuente → nada que comparar (no se inventa contradicción)
    for (const spec of specs) {
      // [Ámbito]: valores agrupados por variante (IPA) o en un único ámbito
      const byScope = new Map<
        string,
        Array<{ item: ComparableItem; value: string }>
      >();
      for (const item of group) {
        const value = spec.read(item.content);
        if (!value) continue;
        const scope = spec.scope?.(item.content) ?? '*';
        byScope.set(scope, [...(byScope.get(scope) ?? []), { item, value }]);
      }
      for (const entries of byScope.values()) {
        if (conflicting(entries, spec)) {
          out.push({
            headline: h,
            field: spec.field,
            items: entries.map(({ item, value }) => ({
              id: item.id,
              key: item.key,
              origin: originOf(item),
              value,
            })),
          });
        }
      }
    }
  }
  return out;
}

// [conflicting]: ¿alguna fuente quedó AISLADA? = su valor no comparte ninguna alternativa con NINGUNA otra fuente
// (A «madre, mamá» · B «madre» · C «mamá» → sin conflicto: A une a B y C · B «padre» → B aislada → contradicción) | `every`/`some` (ES5)
function conflicting(
  entries: ReadonlyArray<{ item: ComparableItem; value: string }>,
  spec: FieldSpec,
): boolean {
  const alts = entries.map((e) => alternativesOf(e.value, !!spec.alternatives));
  return entries.some((a, i) => {
    const others = entries
      .map((b, j) => ({ b, j }))
      .filter(({ b }) => originOf(b.item) !== originOf(a.item));
    return (
      others.length > 0 &&
      others.every(({ j }) => ![...alts[i]].some((x) => alts[j].has(x)))
    );
  });
}

// [draftContradiction]: estado de la bandera en la traza de un borrador de IA frente a lo ya guardado | 'not_checked' si no hay con qué comparar (la especificación prohíbe afirmar «sin contradicciones» sin fuentes)
export function draftContradiction(
  kind: CurriculumItemKind,
  content: Record<string, unknown>,
  stored: ReadonlyArray<ComparableItem>,
): 'not_checked' | 'none' | 'detected' {
  const h = headline(content);
  const peers = stored.filter((i) => headline(i.content) === h);
  if (!peers.length || !SPECS[kind]) return 'not_checked';
  const draft: ComparableItem = {
    id: 'draft',
    key: 'draft',
    source: 'IA (borrador)',
    sourceId: null,
    content,
  };
  return findContradictions(kind, [...peers, draft]).some((c) =>
    c.items.some((i) => i.id === 'draft'),
  )
    ? 'detected'
    : 'none';
}

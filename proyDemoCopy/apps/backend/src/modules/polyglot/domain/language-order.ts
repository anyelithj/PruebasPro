import { isLanguage, type Language } from '../../../shared/domain/language.vo';
// [Función pura languageOrder · Sprint 10.5 · RF-129/RF-131]: orden de las columnas de la tabla poliglota — el que pide el usuario o, por defecto, inglés, alemán, francés, portugués, ruso, chino y español al final | [Patrón]: Pure Function + Specification | [Principio]: SRP + KISS (testeable sin BD) | [Paradigma]: Funcional
// [Espejo]: apps/frontend-angular/src/app/features/polyglot/domain/language-order.ts aplica la misma regla en el navegador (reordenar sin llamar al backend)

export const POLYGLOT_DEFAULT_ORDER: readonly Language[] = Object.freeze([
  'en',
  'de',
  'fr',
  'pt',
  'ru',
  'zh',
  'es',
] as Language[]);

// [languageOrder]: `requested` = «en,de,es» de la query (o lista); se descartan idiomas inválidos y repetidos; vacío → orden por defecto
export function languageOrder(requested?: string | string[] | null): Language[] {
  const raw = Array.isArray(requested)
    ? requested
    : (requested ?? '').split(',');
  const picked = [
    ...new Set(raw.map((l) => l.trim().toLowerCase()).filter(isLanguage)),
  ];
  return picked.length ? picked : [...POLYGLOT_DEFAULT_ORDER];
}

// [needsNativeReview]: el IPA automático de chino mandarín (tonos) y ruso (acento) lo revisa un hablante nativo (RF-132)
export const needsNativeReview = (language: string): boolean =>
  language === 'zh' || language === 'ru';

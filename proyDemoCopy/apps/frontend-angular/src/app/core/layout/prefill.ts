import { CEFR_LEVELS, LANGUAGES } from '@aula/shared-schemas'; // [SSOT]: mismos idiomas y niveles que validan NestJS y Next.js
// [prefill · 2026-10-24]: idioma y nivel elegidos en Gestión → Crear actividad llegan como ?idioma=&nivel= y los editores los usan como valor inicial
// [Principio]: Fail Fast + Robustez (un valor desconocido se ignora, no rompe el formulario) | [Paradigma]: Funcional (funciones puras)

// `find` con comparación estricta → devuelve el literal tipado ('en' | 'fr'…) o null
export const pickLanguage = (v: string | undefined): (typeof LANGUAGES)[number] | null => LANGUAGES.find((l) => l === v) ?? null;
export const pickLevel = (v: string | undefined): (typeof CEFR_LEVELS)[number] | null => CEFR_LEVELS.find((l) => l === v) ?? null;

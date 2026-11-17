// [titleKey · 2026-10-28]: clave normalizada de un título para detectar duplicados («El verbo être!» ≡ «el verbo etre») | [Patrón]: Value Object funcional (normalizador) | [Principio]: SSOT — la usan todos los casos de uso con regla anti-duplicados | [Paradigma]: Funcional (pura)
// `normalize('NFD')` (ES2015): separa letra y tilde → `\p{M}` (Unicode, flag `u`) quita las marcas | `\p{L}\p{N}`: letras y dígitos de CUALQUIER escritura (chino, cirílico…) se conservan
// [Contrato con la BD]: la función SQL `aula_title_key` (migración TitleDedup) es IGUAL o MENOS agresiva que esta → el índice único nunca rechaza lo que esta regla permite
export const titleKey = (title: string | null | undefined): string =>
  (title ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ') // Puntuación, símbolos y espacios repetidos → un espacio
    .trim();

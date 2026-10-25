import { InjectionToken } from '@angular/core';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, LOCALES, type Locale } from '@aula/shared-i18n'; // [SSOT]: idiomas, cookie y type guard del shell Next.js
// [LOCALE · core/i18n]: idioma activo leído de la cookie `ui-lang` que escribe el shell Next.js | [Patrón]: Dependency Injection Token | [Principio]: SSOT (Next.js decide el idioma; Angular lo respeta) | [Paradigma]: Funcional

export { LOCALES, LOCALE_COOKIE, type Locale }; // Re-export: el resto de la app sigue importando desde core/i18n

// [readLocaleCookie]: `document.cookie` (DOM) → 'es' | 'en'; cualquier otro valor cae al idioma por defecto | `RegExp` con grupo de captura
export function readLocaleCookie(cookie = document.cookie): Locale {
  const value = new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`).exec(cookie)?.[1]; // `\\s` dentro del template literal → `\s` en la RegExp
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export const LOCALE = new InjectionToken<Locale>('LOCALE', {
  providedIn: 'root',
  factory: () => readLocaleCookie(),
});

import { cache } from "react"; // [React]: `cache` memoiza por petición en el servidor → la cookie se lee una vez aunque 20 cards pidan el diccionario
import { cookies } from "next/headers"; // [Next.js]: lectura de cookies SOLO en servidor (RSC, Server Actions, Route Handlers)
import { DEFAULT_LOCALE, getDictionary, isLocale, LOCALE_COOKIE, type Dictionary, type Locale } from "@aula/shared-i18n";
// [i18n del lado servidor]: resuelve el idioma desde la cookie `ui-lang` | [Patrón]: Facade + Memoization | [Principio]: SRP (separado de i18n.ts para no arrastrar next/headers al cliente)

// `export const … = cache(async () => …)` (React 19): función asíncrona memoizada durante el render de una petición
export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value; // `?.` (ES2020): undefined si la cookie no existe
  return isLocale(value) ? value : DEFAULT_LOCALE; // [Fail-safe]: valor inválido/manipulado → idioma por defecto
});

// [getServerDictionary]: atajo para Server Components → `const t = await getServerDictionary()` | [Principio]: DRY
export async function getServerDictionary(): Promise<Dictionary> {
  return getDictionary(await getLocale());
}

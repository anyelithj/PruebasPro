import es from "./es.json"; // `resolveJsonModule` (TS): el JSON llega tipado → `Dictionary` se deriva de él
import enJson from "./en.json";
// [@aula/shared-i18n · Sprint 7.1 · RF-86]: diccionarios ES/EN de la interfaz + helpers de interpolación y plural, COMPARTIDOS por Next.js y Angular | [Patrón]: Dictionary (Lookup Table) + SSOT | [Principio]: DRY (un solo diccionario para los dos frontends) + OCP (nuevo idioma = nuevo JSON) | [Paradigma]: Funcional (funciones puras)
// [Tecnología]: TypeScript puro + JSON, sin dependencias de runtime → lo resuelven Turbopack (Next.js), esbuild (Angular) y Jest por el alias @aula/* de cada tsconfig
// [Tipado seguro]: `Dictionary = typeof es` → en.json DEBE tener las mismas claves; si falta una, falla la compilación de las dos apps
// [Formato]: JSON no admite comentarios → el significado de cada sección vive en el nombre de la clave y en este archivo

// `as const` (TS): tupla de literales inmutable → tipo "es" | "en"
export const LOCALES = ["es", "en"] as const;
export type Locale = (typeof LOCALES)[number]; // [Indexed access TS]: unión derivada de la tupla | [Principio]: DRY

export const DEFAULT_LOCALE: Locale = "es"; // Idioma por defecto de la plataforma
export const LOCALE_COOKIE = "ui-lang"; // Cookie legible por el servidor → los Server Components renderizan ya traducidos (sin parpadeo)

// [Type guard]: valida entrada cruda (cookie, query) | `value is Locale` (TS) estrecha el tipo
export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (LOCALES as readonly string[]).includes(value);

// [Formas plurales]: contrato para `plural()` | `interface` (TS): se borra al compilar
export interface PluralForms {
  one: string; // Singular ("{n} curso")
  other: string; // Plural ("{n} cursos")
}

// [Dictionary]: forma del español (fuente) · el inglés se valida contra ella
// [Mapas dinámicos]: JSON no conserva `as Record<string, string>` → se declaran aquí los que se indexan con claves de datos (grupo del curso, opciones del perfil)
type Raw = typeof es;
type Map = Record<string, string>;
export type Dictionary = Omit<Raw, "languageNames" | "profile"> & {
  languageNames: Map;
  profile: Omit<Raw["profile"], "options" | "preferredLanguages"> & { options: Map; preferredLanguages: Map };
};
const esDict: Dictionary = es;
const en: Dictionary = enJson;

// `Object.freeze` (ES5): inmutable en tiempo de ejecución
const DICTIONARIES: Readonly<Record<Locale, Dictionary>> = Object.freeze({ es: esDict, en });

// [getDictionary]: función pura locale → diccionario | [Patrón]: Strategy (el diccionario es la estrategia de textos)
export const getDictionary = (locale: Locale): Dictionary => DICTIONARIES[locale];

// [fmt]: interpolación "{clave}" → valor | `replace` con regex global (ES) + callback | `??` deja el marcador si falta el valor (fallo visible, no silencioso)
export const fmt = (template: string, vars: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => String(vars[key] ?? match));

// [plural]: elige singular/plural según las reglas CLDR del idioma | `Intl.PluralRules` (ECMA-402, stdlib del navegador/Node): sin dependencias
export const plural = (locale: Locale, n: number, forms: PluralForms): string =>
  fmt(new Intl.PluralRules(locale).select(n) === "one" ? forms.one : forms.other, { n });

// [Etiqueta BCP-47 para Intl]: "es" → "es-CO", "en" → "en-US" (formato de números y fechas) | [Patrón]: Lookup Table
export const INTL_LOCALE: Readonly<Record<Locale, string>> = Object.freeze({ es: "es-CO", en: "en-US" });

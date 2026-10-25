"use client"; // [Next.js]: Client Component → usa Context, hooks y APIs del navegador (document, localStorage)
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react"; // [React 19]: hooks de estado, contexto y store externo
import { useRouter } from "next/navigation"; // [Next.js]: `router.refresh()` vuelve a renderizar los Server Components con la nueva cookie de idioma
import { DEFAULT_THEME, THEMES, THEME_STORAGE_KEY, type ThemeKey } from "@aula/ui-tokens/tailwind-preset";
import { getDictionary, LOCALE_COOKIE, type Dictionary, type Locale } from "@aula/shared-i18n";
// [PreferencesProvider]: estado global de UI (idioma + tema) para toda el área del portal | [Patrón]: Provider (React Context) + Observer (store externo del tema) | [Principio]: SRP + DIP (los componentes dependen del hook, no de document/cookies) | [Paradigma]: Funcional + Reactivo

// `interface` (TS): contrato público del contexto | [Principio]: ISP (solo lo que consumen los componentes)
interface PreferencesContextValue {
  locale: Locale; // Idioma activo
  t: Dictionary; // Diccionario del idioma activo (tipado: autocompletado de claves)
  setLocale: (locale: Locale) => void; // Cambia idioma (cookie + refresco de RSC)
  theme: ThemeKey; // Tema activo
  setTheme: (theme: ThemeKey) => void; // Cambia tema (clase en <html> + localStorage)
}

// `createContext<T | null>(null)` (React): null por defecto → el hook detecta uso fuera del Provider
const PreferencesContext = createContext<PreferencesContextValue | null>(null);

// ───────────── Store externo del tema ─────────────
// [Por qué un store externo]: la clase del tema ya la pone el script anti-parpadeo en <html> antes de hidratar; React solo la LEE y la cambia | [Patrón]: Observer
// `new Set<() => void>()` (ES2015): suscriptores únicos, borrado O(1)
const themeListeners = new Set<() => void>();

// [subscribe]: firma exigida por useSyncExternalStore; devuelve la función de baja | [Paradigma]: Funcional (closure)
function subscribeTheme(listener: () => void): () => void {
  themeListeners.add(listener);
  return () => themeListeners.delete(listener);
}

// [getSnapshot]: lee el tema actual desde el DOM | `find` (ES2015) + `??` (ES2020): primer tema presente o el de por defecto
function readTheme(): ThemeKey {
  return THEMES.find((key) => document.documentElement.classList.contains(key)) ?? DEFAULT_THEME;
}

// [getServerSnapshot]: en SSR no hay DOM → tema por defecto; React re-renderiza tras hidratar sin error de "hydration mismatch"
const readServerTheme = (): ThemeKey => DEFAULT_THEME;

// [applyTheme]: comando que muta el DOM, persiste (opcional) y notifica | [Patrón]: Command + Observer
// `persist = false`: cambio temporal (p. ej. páginas públicas que solo admiten Claro/Oscuro) sin pisar la preferencia guardada del portal
export function applyTheme(next: ThemeKey, persist = true): void {
  const root = document.documentElement; // <html>
  root.classList.remove(...THEMES); // `...` spread (ES2015): quita cualquier tema previo
  root.classList.add(next); // Aplica el nuevo → las variables CSS --nl-* cambian en cascada
  try {
    if (persist) localStorage.setItem(THEME_STORAGE_KEY, next); // Persistencia por navegador (lo lee THEME_INIT_SCRIPT al recargar)
  } catch {
    // [Fail-soft]: modo privado o almacenamiento bloqueado → el tema funciona solo en esta sesión
  }
  themeListeners.forEach((notify) => notify()); // Avisa a los componentes suscritos
}

// `export function` + props tipadas inline (TS) | `initialLocale` viene del servidor (cookie) → primer render ya traducido
export function PreferencesProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale); // `useState<T>` (React): estado local tipado
  const [, startTransition] = useTransition(); // [React]: el refresco de RSC no bloquea la interacción
  const theme = useSyncExternalStore(subscribeTheme, readTheme, readServerTheme); // [React 18+]: suscripción segura a un store externo (sin tearing)

  // [Efecto de sincronización]: <html lang> refleja el idioma activo → lectores de pantalla pronuncian bien (WCAG 3.1.1)
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // `useCallback` (React): referencia estable → los consumidores memoizados no se re-renderizan de más
  const setLocale = useCallback(
    (next: Locale) => {
      // [Cookie de preferencia]: 1 año, path raíz, SameSite=Lax | no es httpOnly porque no es un secreto y la escribe el cliente
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      setLocaleState(next); // Los Client Components cambian al instante
      startTransition(() => router.refresh()); // Los Server Components se vuelven a pedir con la nueva cookie
    },
    [router],
  );

  // `useMemo` (React): recalcula el objeto del contexto solo si cambia idioma o tema | [Rendimiento]
  const value = useMemo<PreferencesContextValue>(
    () => ({ locale, t: getDictionary(locale), setLocale, theme, setTheme: (next: ThemeKey) => applyTheme(next) }),
    [locale, setLocale, theme],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

// [Valor por defecto]: fuera del Provider (tests unitarios, componentes aislados) se usa español + tema claro | [Patrón]: Null Object
const FALLBACK: PreferencesContextValue = {
  locale: "es",
  t: getDictionary("es"),
  setLocale: () => undefined, // No-op: sin Provider no hay cookie ni refresco
  theme: DEFAULT_THEME,
  setTheme: (next) => applyTheme(next),
};

// [usePreferences]: hook de acceso al contexto | [Patrón]: Custom Hook | `??` (ES2020): sin Provider → valor por defecto
export function usePreferences(): PreferencesContextValue {
  return useContext(PreferencesContext) ?? FALLBACK;
}

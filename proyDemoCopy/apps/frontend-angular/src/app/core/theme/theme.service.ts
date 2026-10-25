import { DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { DEFAULT_THEME, isTheme, THEME_META, THEME_STORAGE_KEY, THEMES, type ThemeKey } from '@aula/ui-tokens/tailwind-preset'; // [SSOT]: los 6 temas, su icono/color y la clave de almacenamiento vienen del shell Next.js
// [ThemeService · core/theme]: tema activo compartido con Next.js (localStorage «ui-theme» + clase en <html>) | [Patrón]: Singleton + Observer (evento `storage` entre pestañas) | [Principio]: SSOT (los 6 temas y sus colores viven en apps/frontend-next/src/app/globals.css y config/themes.ts) | [Paradigma]: Reactivo (signals + effect)

export { isTheme, THEME_META, THEME_STORAGE_KEY, THEMES, type ThemeKey }; // Re-export: el resto de la app importa desde core/theme

// [readStored]: `try/catch` → localStorage puede lanzar (modo privado, almacenamiento bloqueado)
function readStored(): ThemeKey {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(v) ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  readonly theme = signal<ThemeKey>(readStored());

  constructor() {
    // `effect` (Angular): cada cambio de `theme` aplica la clase en <html> (una sola clase de tema a la vez)
    effect(() => {
      const root = this.doc.documentElement;
      root.classList.remove(...THEMES);
      root.classList.add(this.theme());
    });
    // [Sincronía]: si el usuario cambia el tema en Next.js (otra pestaña), Angular lo sigue | `storage` (DOM) solo llega desde OTRAS pestañas
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && isTheme(e.newValue)) this.theme.set(e.newValue);
    };
    window.addEventListener('storage', onStorage);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('storage', onStorage));
  }

  // [set]: cambia y persiste (Next.js lo leerá al volver al portal)
  set(theme: ThemeKey): void {
    this.theme.set(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Sin almacenamiento: el tema dura lo que la pestaña
    }
  }
}

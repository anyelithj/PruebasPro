"use client"; // [Next.js]: Client Component → textos del idioma activo y guardián de tema
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { BRAND } from "@/config/brand";
import { PUBLIC_THEMES, THEME_STORAGE_KEY, isTheme } from "@aula/ui-tokens/tailwind-preset";
import { applyTheme, usePreferences } from "@/components/layout/PreferencesProvider";
import { LanguageMenu, ThemeMenu } from "@/components/portal/PortalToolbar";
// [PublicNavbar]: barra de las páginas públicas (landing, login, registro) — marca, secciones, tema Claro/Oscuro e idioma | [Patrón]: Composite + DRY (reutiliza ThemeMenu/LanguageMenu del portal) | [Principio]: SRP | [Paradigma]: Declarativo

// [Secciones de la landing]: anclas internas (solo en la home)
// [Sprint 7.13]: el orden del informe (Idiomas, Niveles, Cómo funciona, Planes y FAQ)
const SECTIONS = [
  { href: "#cursos", key: "courses" }, // Primero: los cursos de idiomas son el servicio principal de la plataforma
  { href: "#niveles", key: "levels" },
  { href: "#como-funciona", key: "how" },
  { href: "#planes", key: "pricing" },
  { href: "#faq", key: "faq" },
] as const;

// `showSections`: la landing muestra las anclas; login/registro no (no tendrían destino)
export function PublicNavbar({ showSections = false }: { showSections?: boolean }) {
  const { t, theme } = usePreferences();
  const n = t.publicNav;
  const [menuOpen, setMenuOpen] = useState(false); // [Menú móvil]: panel desplegable bajo la barra (< lg)

  // [Escape cierra el menú]: WCAG 2.1.2 (sin trampa de teclado) | listener solo mientras está abierto
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // [Guardián de tema público]: si se llega desde el portal con un tema no permitido (sepia, VR…) se muestra Claro sin borrar la preferencia; al salir se restaura | [Patrón]: Scoped Side Effect (cleanup)
  useEffect(() => {
    if (PUBLIC_THEMES.includes(theme)) return;
    applyTheme("light", false);
    return () => {
      try {
        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        if (isTheme(saved)) applyTheme(saved, false); // Vuelve al tema elegido en el portal
      } catch {
        /* storage bloqueado: se queda en claro */
      }
    };
  }, [theme]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 text-lg font-bold text-foreground" aria-label={`${BRAND.name} — ${n.home}`}>
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-brand text-white" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 2a3 3 0 0 0-3 3 3 3 0 0 0-3 3 3 3 0 0 0 0 6 3 3 0 0 0 3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0 3-3 3 3 0 0 0 0-6 3 3 0 0 0-3-3 3 3 0 0 0-3-3z" />
            </svg>
          </span>
          <span className="hidden sm:inline">
            {BRAND.prefix} <b className="text-tone-brand">{BRAND.highlight}</b>{/* [2026-10-23 · 4.º pase]: tono de marca oscuro → contraste AA (4.03:1 con text-primary sobre la barra translúcida) */}
          </span>
        </Link>

        {showSections && (
          <nav aria-label={n.home} className="hidden items-center gap-7 lg:flex">
            {SECTIONS.map((s) => (
              <a key={s.href} href={s.href} className="text-sm font-medium text-muted-foreground hover:text-primary">
                {n[s.key]}
              </a>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-1.5">
          <ThemeMenu themes={PUBLIC_THEMES} />
          <LanguageMenu />
          {/* [2026-10-23 · 4.º pase]: «Iniciar sesión» vuelve a su color de contorno (distinto del morado de «Registrarse») · ambos con el radio de «Comenzar gratis» (btn-cta) */}
          <Link href="/login" className="btn btn-outline btn-sm btn-cta hidden sm:inline-flex">
            {n.login}
          </Link>
          <Link href="/register" className="btn btn-primary btn-sm btn-cta">
            {n.register}
          </Link>
          {/* [Hamburguesa]: solo < lg (secciones ocultas) o < sm (botón de login oculto) | `aria-expanded` + `aria-controls` (WAI-ARIA) */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? t.nav.closeMenu : t.nav.openMenu}
            aria-expanded={menuOpen}
            aria-controls="public-mobile-menu"
            className={`grid size-9 place-items-center rounded-lg border border-border text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${showSections ? "lg:hidden" : "sm:hidden"}`}
          >
            {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>

      {/* [Panel móvil]: secciones + iniciar sesión; se cierra al elegir un enlace */}
      {menuOpen && (
        <nav id="public-mobile-menu" aria-label={n.home} className={`border-t border-border bg-background px-4 py-3 sm:px-6 ${showSections ? "lg:hidden" : "sm:hidden"}`}>
          <ul className="mx-auto flex max-w-[1240px] flex-col gap-1">
            {showSections &&
              SECTIONS.map((s) => (
                <li key={s.href}>
                  <a href={s.href} onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-primary">
                    {n[s.key]}
                  </a>
                </li>
              ))}
            <li className="sm:hidden">
              <Link href="/login" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-primary hover:bg-muted">
                {n.login}
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}

import { isSocialUrl, SOCIAL_META, SOCIAL_NETWORKS, type SocialLinks as SocialLinksData, type SocialNetwork } from "@/types/profile";
// [SocialLinks · 2026-10-28]: iconos-enlace a las redes del docente (LinkedIn, X, Spotify, YouTube) — oculta las no configuradas | [Patrón]: Presentational (atom) + Lookup Table (icono por red) | [Principio]: SRP + DRY + OCP (nueva red = nueva entrada en SOCIAL_META e ICON_PATH)
// Sin "use client": sin estado ni eventos → Server Component (cero JS en el navegador) | [Paradigma]: Funcional + Declarativo
// [Iconos]: lucide-react 1.x ya no trae logotipos de marca → trazos SVG oficiales (Simple Icons, CC0) en línea, `fill="currentColor"` (heredan el color del tema)

// `Readonly<Record<…>>` (TS): un path SVG (viewBox 0 0 24 24) por red
const ICON_PATH: Readonly<Record<SocialNetwork, string>> = {
  linkedin:
    "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  twitter: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
  spotify:
    "M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z",
  youtube:
    "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
};

interface SocialLinksProps {
  links: Partial<SocialLinksData> | null | undefined; // `Partial` + `| null`: tolera backend sin el campo o autor sin redes
  owner: string; // Nombre del dueño → aria-label «LinkedIn de Ana Pérez»
  color?: string; // Color del idioma del curso (realce al pasar el ratón)
  showEmpty?: boolean; // [2026-10-31]: también las redes sin configurar (atenuadas) → los iconos siempre se ven en «Autoría del contenido»
  emptyHref?: string; // [2026-10-31]: destino de un icono sin configurar (quien gestiona el curso completa su perfil)
}

export function SocialLinks({ links, owner, color, showEmpty = false, emptyHref }: SocialLinksProps) {
  // [Filtro]: solo redes con URL válida (https + dominio; re-validada aquí también → nunca un `javascript:` en el href) | `flatMap` (ES2019): filtra y mapea en una pasada
  const items = SOCIAL_NETWORKS.flatMap((n): { n: SocialNetwork; href: string | null }[] => {
    const href = links?.[n]?.trim();
    return href && isSocialUrl(n, href) ? [{ n, href }] : showEmpty ? [{ n, href: null }] : [];
  });
  if (items.length === 0) return null; // [Guard clause]: sin redes → no se pinta nada

  return (
    // <ul> (HTML): lista de enlaces → el lector anuncia «lista, 3 elementos» | `aria-label`: nombra el grupo
    <ul aria-label={`Redes sociales de ${owner}`} className="flex flex-wrap gap-2">
      {items.map(({ n, href }) => {
        const icon = (
          <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="currentColor">
            <path d={ICON_PATH[n]} />
          </svg>
        );
        const circle = "grid size-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors";
        const link = "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
        return (
          <li key={n}>
            {/* `target="_blank"` + `rel="noopener noreferrer"`: pestaña nueva sin dar acceso a `window.opener` ni filtrar el Referer | [Seguridad] (tabnabbing)
                `size-9` (36px) + `grid place-items-center`: área táctil cómoda | `focus-visible:ring-*`: foco visible solo con teclado (WCAG 2.4.7) */}
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${SOCIAL_META[n].label} de ${owner} (se abre en una pestaña nueva)`}
                title={SOCIAL_META[n].label}
                className={`${circle} ${link} hover:text-[var(--social-hover)]`}
                style={{ "--social-hover": color ?? "var(--nl-txt)" } as React.CSSProperties} // Variable CSS en línea → el hover usa el color del curso sin JS
              >
                {icon}
              </a>
            ) : emptyHref ? (
              // [Sin configurar · quien gestiona el curso]: el icono lleva a completar el perfil
              <a href={emptyHref} aria-label={`Añadir ${SOCIAL_META[n].label}`} title={`Añadir ${SOCIAL_META[n].label}`} className={`${circle} ${link} opacity-50 hover:opacity-100`}>
                {icon}
              </a>
            ) : (
              // [Sin configurar · estudiante]: atenuado y sin enlace | `role="img"`: el lector anuncia el estado (no solo el color, WCAG 1.4.1)
              <span role="img" aria-label={`${SOCIAL_META[n].label}: no configurado`} title={`${SOCIAL_META[n].label}: no configurado`} className={`${circle} cursor-not-allowed opacity-40`}>
                {icon}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

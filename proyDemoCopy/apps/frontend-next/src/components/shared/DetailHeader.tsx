import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
// [DetailHeader · DetailGrid · DetailCard · ToneBadge · 2026-10-28]: piezas de la página de DETALLE de Gestión — el diseño del tema de Recursos (/admin/curriculum/tema)
// extraído para que el detalle de un examen (/quiz/[id]) y la revisión de una actividad (/admin/activities/ver/[tab]/[id]) sean idénticos
// Cabecera `surface` con icono de 64 px en tono de marca, título grande, línea de datos (tipo · idioma · nivel · N elementos · estado) y acciones a la derecha;
// debajo, rejilla responsive de tarjetas (barra superior bg-muted con título + estado, cuerpo con la vista previa y pie con acciones)
// [Patrón]: Atomic Design (moléculas) + Presentational + Slots (props ReactNode) | [Principio]: DRY + OCP (cada página aporta su contenido) | [Paradigma]: Declarativo
// [Tecnología]: sin "use client" ni hooks → sirven en Server Components (RSC) y en Client Components · Tailwind CSS (utilidades `surface`, tonos de marca)

export interface DetailHeaderProps {
  icon: ReactNode; // Icono SVG del tipo (KindIcon, icono de la sección, CategoryIcon…) | decorativo
  title: ReactNode; // <h1> de la página
  meta?: ReactNode; // Línea de datos bajo el título
  actions?: ReactNode; // RowActions, DownloadMenu… (a la derecha; bajan de línea en móvil con flex-wrap)
  children?: ReactNode; // Contenido extra entre el título y los datos (p. ej. TopicTitle o la descripción)
}

export function DetailHeader({ icon, title, meta, actions, children }: DetailHeaderProps) {
  return (
    // [Semántica]: <header> de la página | `flex-wrap`: en pantallas estrechas las acciones pasan debajo (responsive sin media queries)
    <header className="surface flex flex-wrap items-center gap-4 p-5">
      <span aria-hidden className="grid size-16 shrink-0 place-items-center rounded-2xl bg-tone-brand-soft text-tone-brand">
        {icon}
      </span>
      {/* `min-w-0` (Tailwind): permite que el título largo haga salto de línea en vez de desbordar el flex */}
      <div className="min-w-0 flex-1">
        <h1 className="title-page">{title}</h1>
        {children}
        {meta && <p className="mt-1 text-muted-foreground">{meta}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

// [DetailGrid]: <ul> en rejilla auto-fill (mín. 260 px por tarjeta, como el tema de Recursos) | `minWidth` permite tarjetas más anchas (vista previa de una actividad)
// `masonry` (2026-11-14): columnas CSS en vez de filas → tarjetas de alto muy distinto (fichas de pronunciación) no dejan huecos vacíos
export function DetailGrid({ children, minWidth = 260, label, masonry = false }: { children: ReactNode; minWidth?: number; label?: string; masonry?: boolean }) {
  if (masonry)
    return (
      // `column-width` (CSS Multi-column): tantas columnas como quepan · `break-inside-avoid`: una tarjeta nunca se parte entre columnas
      <ul aria-label={label} className="gap-4 [&>li]:mb-4 [&>li]:break-inside-avoid" style={{ columnWidth: `min(100%, ${minWidth}px)` }}>
        {children}
      </ul>
    );
  // `CSSProperties` (React/TS): estilo en línea tipado → `repeat(auto-fill, minmax())` no es una clase Tailwind fija con un valor variable
  const style: CSSProperties = { gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${minWidth}px), 1fr))` }; // `min(100%, …)` (CSS): sin desbordar en móvil
  return (
    <ul aria-label={label} className="grid gap-4" style={style}>
      {children}
    </ul>
  );
}

export interface DetailCardProps {
  title: ReactNode; // Enlace o texto de la barra superior
  badge?: ReactNode; // Estado (StatusBadge / ToneBadge) a la derecha de la barra
  footer?: ReactNode; // Acciones del elemento
  children: ReactNode; // Cuerpo (vista previa)
  lang?: string; // `lang` (HTML): idioma del contenido → lectores de pantalla y separación silábica correctos
  className?: string;
}

// [DetailCard]: <li> de DetailGrid | `overflow-hidden`: la barra bg-muted respeta las esquinas redondeadas de `surface`
export function DetailCard({ title, badge, footer, children, lang, className }: DetailCardProps) {
  return (
    <li className={cn("surface flex flex-col overflow-hidden", className)}>
      <header className="flex items-center justify-between gap-2 border-b border-border bg-muted px-4 py-2">
        <div className="min-w-0 truncate text-sm font-semibold">{title}</div>
        {badge}
      </header>
      <div className="min-w-0 flex-1 p-4" lang={lang}>
        {children}
      </div>
      {footer && <footer className="border-t border-border px-3 py-2">{footer}</footer>}
    </li>
  );
}

// [ToneBadge]: insignia de estado con el MISMO aspecto que StatusBadge (Recursos) para entidades con otros estados (exámenes, actividades)
// `Readonly<Record<…>>` (TS): un tono por clave, sin olvidar ninguno | [A11y]: el significado va en el TEXTO, no solo en el color (WCAG 1.4.1)
export type BadgeTone = "brand" | "warning" | "danger" | "muted";
const TONE_CLASS: Readonly<Record<BadgeTone, string>> = {
  brand: "bg-tone-brand-soft text-tone-brand",
  warning: "bg-tone-warning-soft text-tone-warning",
  danger: "bg-tone-danger-soft text-tone-danger",
  muted: "bg-muted text-muted-foreground",
};

export function ToneBadge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap", TONE_CLASS[tone])}>{children}</span>;
}

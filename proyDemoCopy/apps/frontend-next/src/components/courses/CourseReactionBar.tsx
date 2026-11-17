"use client"; // [Next.js]: Client Component → clics y Optimistic UI
import { Heart, Star, ThumbsUp, type LucideIcon } from "lucide-react"; // [lucide-react]: iconos SVG (además del color → WCAG 1.4.1)
import { fmt } from "@aula/shared-i18n"; // [i18n]: interpolación «{n}» de los textos compartidos ES/EN
import { usePreferences } from "@/components/layout/PreferencesProvider";
import { useCourseEngagement, type EngagementAction } from "@/hooks/useCourses";
import type { CourseEngagement } from "@/types/courses";
// [CourseReactionBar · Caso F · 2026-11-13]: barra ÚNICA ⭐ Favorito · 👍 Me gusta · ❤️ Me encanta → la usan la card del catálogo, el detalle y «Mis favoritos»
// ⭐ = guardar (privado, sin conteo) · 👍/❤️ = valoración excluyente con conteo público
// [Patrón]: Presentational + Custom Hook (estado en useCourseEngagement) + Lookup Table (estilo por acción) | [Principio]: SRP + DRY
// [A11y]: <button aria-pressed> (estado anunciado), nombre accesible con el conteo, `title` con el significado, icono + texto (no solo color) | [UX]: sin recargar

// [STYLE]: icono y color propios por acción | `Readonly<Record<…>>` (TS): mapa inmutable y exhaustivo | `as const` no hace falta: el tipo lo fija Record
const STYLE: Readonly<Record<EngagementAction, { color: string; Icon: LucideIcon }>> = {
  favorite: { color: "#D4A017", Icon: Star },
  like: { color: "#3B82F6", Icon: ThumbsUp },
  love: { color: "#FF6B6B", Icon: Heart },
};

export function CourseReactionBar({ courseId, initial, className = "" }: { courseId: string; initial: CourseEngagement; className?: string }) {
  const { t } = usePreferences();
  const a = t.courses.actions;
  const { state, pending, toggleFavorite, react } = useCourseEngagement(courseId, initial);

  return (
    // `role="group"` + `aria-label` (WAI-ARIA): el lector de pantalla anuncia el grupo de acciones del curso
    <div role="group" aria-label={a.reactionsLabel} className={`mt-2.5 flex flex-wrap items-center gap-[5px] border-t border-border pt-2 ${className}`}>
      <Pill action="favorite" on={state.isFavorite} label={a.favorite} hint={a.favoriteHint} disabled={pending === "favorite"} onClick={toggleFavorite} />
      <Pill action="like" on={state.reaction === "like"} label={a.like} count={state.likesCount} hint={a.likeHint} disabled={pending !== null && pending !== "favorite"} onClick={() => react("like")} />
      <Pill action="love" on={state.reaction === "love"} label={a.love} count={state.lovesCount} hint={a.loveHint} disabled={pending !== null && pending !== "favorite"} onClick={() => react("love")} />
      {/* `aria-live` (WAI-ARIA): anuncia los conteos actualizados sin mover el foco */}
      <span className="sr-only" aria-live="polite">{fmt(a.countsLive, { likes: state.likesCount, loves: state.lovesCount })}</span>
    </div>
  );
}

interface PillProps {
  action: EngagementAction;
  on: boolean;
  label: string;
  hint: string; // Significado de la acción (tooltip)
  count?: number; // Solo 👍/❤️ (el favorito no tiene conteo público)
  disabled: boolean;
  onClick: () => void;
}

// [Pill]: botón conmutador | `aria-pressed` (WAI-ARIA): activo/inactivo | 👍/❤️ comparten «disabled» mientras una reacción está en vuelo (excluyentes)
function Pill({ action, on, label, hint, count, disabled, onClick }: PillProps) {
  const { color, Icon } = STYLE[action];
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation(); // No dispara la navegación de la card
        onClick();
      }}
      disabled={disabled}
      aria-pressed={on}
      aria-label={count === undefined ? label : `${label} (${count})`}
      title={hint}
      className="flex min-h-8 cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors duration-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{ borderColor: on ? color : "var(--nl-brd)", background: on ? `${color}22` : "transparent", color: on ? color : "var(--nl-txt2)" }}
    >
      <Icon aria-hidden className="size-3.5" fill={on ? "currentColor" : "none"} /> {label}
      {count !== undefined && <span className="tabular-nums opacity-80">{count}</span>}
    </button>
  );
}

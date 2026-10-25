"use client"; // [Next.js]: Client Component → clics, navegación y Optimistic UI

import { useTransition, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fmt, type Dictionary } from "@aula/shared-i18n";
import { usePreferences } from "@/components/layout/PreferencesProvider";
import { useCart } from "@/hooks/useCart";
import { useCourseReactions } from "@/hooks/useCourses"; // [2026-10-23 · 4.º pase]: reacciones optimistas en su hook (SRP)
import { enrollAction } from "@/lib/purchase-actions"; // [Inscripción gratuita]: Server Action → desbloquea el material // [Carrito]: "Comprar" agrega al carrito del topbar (como NeuroLearning)
// [cra · CourseActions]: CTA dinámica + botón Lab + barra de reacciones (★ 👍 ❤) del original | [Patrón]: Optimistic Update + Strategy (etiqueta según progreso) | [Principio]: SRP

const GOLD = "#D4A017"; // Favorito (igual al original)
const CORAL = "#FF6B6B"; // Me encanta (igual al original)

export interface CourseActionsProps {
  courseId: string;
  // [estado del curso]: 0 = no iniciado, 1-99 = en curso, 100 = completado
  progress: number;
  isFree: boolean;
  hasAccess?: boolean; // [Comprado o inscrito]: sin él se asume sin acceso
  color: string;
  lab?: string | null; // Laboratorio asociado → botón "Lab" (activo si el curso ya empezó)
  // [estado inicial servidor]: hidrata para evitar parpadeo SSR/CSR | [Principio]: SSOT
  initialFavorite?: boolean;
  initialLike?: boolean;
  initialLove?: boolean;
  // [primaryHref]: navegación principal de la card — detalle o lección | [Patrón]: URL State
  primaryHref?: string;
  // [variant]: card = CTA + Lab + reacciones · detail = solo CTA grande | [Principio]: OCP
  variant?: "card" | "detail";
  // [purchase]: datos para el carrito (solo cursos de pago) | `?` (TS): opcional → sin él, "Comprar" navega al detalle
  purchase?: { title: string; price: number; currency: string };
}

// [primaryLabel]: deriva la etiqueta del progreso + isFree (misma regla que el original) | [Patrón]: Strategy | [Paradigma]: Funcional (pura)
function primaryLabel(progress: number, isFree: boolean, hasAccess: boolean, t: Dictionary["courses"]["actions"]): string {
  if (!hasAccess) return isFree ? t.enterFree : t.buy; // Sin acceso: inscribirse (gratis) o comprar
  if (progress === 100) return t.certificate;
  if (progress > 0) return t.continue;
  return t.start; // Con acceso y sin empezar
}

// [Estilo del botón primario]: degradado morado de marca (sustituye el verde del original) | [Principio]: DRY (lo usan card y detail)
const PRIMARY_CLASS =
  "cursor-pointer rounded-full bg-gradient-brand font-semibold text-white transition-[transform,opacity] hover:-translate-y-0.5 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function CourseActions({
  courseId,
  progress,
  isFree,
  hasAccess = false,
  color,
  lab,
  initialFavorite = false,
  initialLike = false,
  initialLove = false,
  primaryHref,
  variant = "card",
  purchase,
}: CourseActionsProps) {
  const router = useRouter();
  const { t } = usePreferences();
  const cart = useCart();
  const buyable = !hasAccess && !isFree && Boolean(purchase); // Curso de pago aún no comprado
  const [enrolling, startEnrolling] = useTransition(); // [React 19]: estado de la inscripción gratuita
  const inCart = buyable && cart.has(courseId);
  const { state, pending, toggle } = useCourseReactions(courseId, { favorite: initialFavorite, like: initialLike, love: initialLove });

  // [Acción primaria]: comprar → al carrito (si ya está, abre el detalle) · resto → navegar | [Patrón]: Strategy
  const goPrimary = useCallback(() => {
    // [Gratis sin inscripción]: inscribe y refresca (aparece el material); si falla, lleva al detalle
    if (!hasAccess && isFree) {
      startEnrolling(async () => {
        const res = await enrollAction(courseId);
        if (res.ok) router.refresh();
        else if (primaryHref) router.push(primaryHref);
      });
      return;
    }
    if (buyable && purchase && !cart.has(courseId)) {
      cart.add({ id: courseId, title: purchase.title, price: purchase.price, currency: purchase.currency, color, href: primaryHref ?? "/courses" });
      return;
    }
    // [Sprint 7.8]: curso al 100 % → «◈ Certificado» abre Mis certificados (pantalla Angular: navegación completa, como los ítems `hard` del menú)
    if (hasAccess && progress === 100) {
      window.location.assign("/certificados");
      return;
    }
    if (primaryHref) router.push(primaryHref);
  }, [hasAccess, isFree, progress, buyable, purchase, cart, courseId, color, primaryHref, router]);

  const primary = enrolling ? t.courses.actions.enrolling : inCart ? t.courses.actions.inCart : primaryLabel(progress, isFree, hasAccess, t.courses.actions);

  if (variant === "detail") {
    return (
      <button type="button" onClick={goPrimary} disabled={enrolling} aria-busy={enrolling} className={`${PRIMARY_CLASS} w-full py-2.5 text-sm`}>
        {primary}
      </button>
    );
  }

  return (
    <>
      {/* Fila de acción: CTA dinámica + espacio + Lab */}
      <div className="mt-2.5 flex items-center gap-1.5">
        <button type="button" onClick={goPrimary} disabled={enrolling} aria-busy={enrolling} className={`${PRIMARY_CLASS} px-[13px] py-1 text-[11px]`}>
          {primary}
        </button>

        <div className="flex-1" />

        {/* [Lab]: activo (enlace) si el curso ya empezó; atenuado con candado si no — igual al original */}
        {lab && progress > 0 && primaryHref && (
          <Link
            href={primaryHref}
            title={fmt(t.courses.card.goLab, { lab })}
            className="flex items-center gap-1 rounded-lg px-2 py-[5px] text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ background: `${color}18`, border: `1px solid ${color}44`, color }}
          >
            <svg width="16" height="10" viewBox="0 0 32 20" aria-hidden>
              <rect x="1" y="4" width="30" height="12" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="10" cy="10" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="22" cy="10" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <line x1="15" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            {t.courses.card.lab}
          </Link>
        )}
        {lab && progress === 0 && (
          <span
            title={t.courses.card.labLocked}
            className="flex items-center gap-1 rounded-lg border border-border bg-muted px-2 py-[5px] text-[10px] text-muted-foreground opacity-40"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" aria-hidden>
              <rect x="4" y="9" width="12" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M6 9 L6 6 Q6 2 10 2 Q14 2 14 6 L14 9" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            {t.courses.card.lab}
          </span>
        )}
      </div>

      {/* Barra de reacciones */}
      <div className="mt-2.5 flex flex-wrap items-center gap-[5px] border-t border-border pt-2">
        <ReactionPill on={state.favorite} color={GOLD} label={t.courses.actions.favorite} disabled={pending === "favorite"} onClick={() => toggle("favorite")} />
        <ReactionPill on={state.like} color={color} label={t.courses.actions.like} disabled={pending === "like"} onClick={() => toggle("like")} />
        <ReactionPill on={state.love} color={CORAL} label={t.courses.actions.love} disabled={pending === "love"} onClick={() => toggle("love")} />
      </div>
    </>
  );
}

interface ReactionPillProps {
  on: boolean;
  color: string;
  label: string; // Incluye el icono ("★ Favorito") igual que el original
  disabled?: boolean;
  onClick: () => void;
}

// [ReactionPill]: botón conmutador | `aria-pressed` (WAI-ARIA): anuncia el estado activo/inactivo al lector de pantalla
function ReactionPill({ on, color, label, disabled, onClick }: ReactionPillProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation(); // No dispara navegación de la card
        onClick();
      }}
      disabled={disabled}
      aria-pressed={on}
      className="flex cursor-pointer items-center gap-[3px] rounded-[20px] px-2.5 py-1 text-[11px] transition-all duration-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      style={{
        border: `1px solid ${on ? color : "var(--nl-brd)"}`,
        background: on ? `${color}22` : "transparent",
        color: on ? color : "var(--nl-txt2)",
      }}
    >
      {label}
    </button>
  );
}

"use client"; // [Next.js]: Client Component → clics, navegación y Optimistic UI

import { useTransition, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fmt, type Dictionary } from "@aula/shared-i18n";
import { usePreferences } from "@/components/layout/PreferencesProvider";
import { useCart } from "@/hooks/useCart";
import { CourseReactionBar } from "@/components/courses/CourseReactionBar"; // [Caso F · 2026-11-13]: barra ÚNICA ⭐ 👍 ❤️ (card, detalle y «Mis favoritos»)
import type { CourseEngagement } from "@/types/courses";
import { enrollAction } from "@/lib/purchase-actions"; // [Inscripción gratuita]: Server Action → desbloquea el material // [Carrito]: "Comprar" agrega al carrito del topbar (como NeuroLearning)
// [cra · CourseActions]: CTA dinámica + botón Lab + barra de reacciones (★ 👍 ❤) del original | [Patrón]: Optimistic Update + Strategy (etiqueta según progreso) | [Principio]: SRP


export interface CourseActionsProps {
  courseId: string;
  // [estado del curso]: 0 = no iniciado, 1-99 = en curso, 100 = completado
  progress: number;
  isFree: boolean;
  hasAccess?: boolean; // [Comprado o inscrito]: sin él se asume sin acceso
  color: string;
  lab?: string | null; // Laboratorio asociado → botón "Lab" (activo si el curso ya empezó)
  // [estado inicial servidor · Caso F]: ⭐ + reacción + conteos → hidrata sin parpadeo SSR/CSR y conserva el estado al recargar | [Principio]: SSOT
  engagement: CourseEngagement;
  // [primaryHref]: navegación principal de la card — detalle o lección | [Patrón]: URL State
  primaryHref?: string;
  // [variant]: card = CTA + Lab + reacciones · detail = solo CTA grande | [Principio]: OCP
  variant?: "card" | "detail";
  // [purchase]: datos para el carrito (solo cursos de pago) | `?` (TS): opcional → sin él, "Comprar" navega al detalle
  purchase?: { title: string; price: number; currency: string };
  canStart?: boolean; // [2026-11-04]: puede entrar al temario (inscrito/comprado, ADMIN o docente dueño) → habilita «Iniciar curso» del detalle | por defecto = hasAccess
}

// [primaryLabel]: deriva la etiqueta del progreso + isFree (misma regla que el original) | [Patrón]: Strategy | [Paradigma]: Funcional (pura)
function primaryLabel(progress: number, isFree: boolean, hasAccess: boolean, t: Dictionary["courses"]["actions"]): string {
  if (!hasAccess) return isFree ? t.enterFree : t.buy; // Sin acceso: inscribirse (gratis) o comprar
  if (progress === 100) return t.finalExam; // [2026-11-06]: el certificado se gana aprobando el examen final
  if (progress > 0) return t.continue;
  return t.start; // Con acceso y sin empezar
}

// [Estilo del botón primario]: degradado morado de marca (sustituye el verde del original) | [Principio]: DRY (lo usan card y detail)
const PRIMARY_CLASS =
  "cursor-pointer rounded-full bg-gradient-brand font-semibold text-white transition-[transform,opacity] hover:-translate-y-0.5 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

// [COURSE_CTA_CLASS · 2026-10-31]: botón grande de la columna lateral del curso («Iniciar curso», «Adjuntar material») → mismo ancho y altura | [Principio]: DRY + SSOT
export const COURSE_CTA_CLASS = `${PRIMARY_CLASS} w-full py-2.5 text-sm`;

export function CourseActions({
  courseId,
  progress,
  isFree,
  hasAccess = false,
  color,
  lab,
  engagement,
  primaryHref,
  variant = "card",
  purchase,
  canStart = hasAccess,
}: CourseActionsProps) {
  const router = useRouter();
  const { t } = usePreferences();
  const cart = useCart();
  const buyable = !hasAccess && !isFree && Boolean(purchase); // Curso de pago aún no comprado
  const [enrolling, startEnrolling] = useTransition(); // [React 19]: estado de la inscripción gratuita
  const inCart = buyable && cart.has(courseId);

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
    // [2026-11-06]: curso al 100 % → examen final (aprobado → certificado automático)
    if (hasAccess && progress === 100) {
      router.push(`/quiz/examen/curso/${courseId}?desde=curso`);
      return;
    }
    if (primaryHref) router.push(primaryHref);
  }, [hasAccess, isFree, progress, buyable, purchase, cart, courseId, color, primaryHref, router]);

  const primary = enrolling ? t.courses.actions.enrolling : inCart ? t.courses.actions.inCart : primaryLabel(progress, isFree, hasAccess, t.courses.actions);

  // [Reacciones · Caso F]: también en el detalle («Acceso al curso») → mismo componente, sin lógica duplicada
  const reactions = <CourseReactionBar courseId={courseId} initial={engagement} />;

  // [Detalle · 2026-11-04]: «Acceso al curso» con DOS botones → 1) Comprar / Inscribirse (o «ya lo tienes») · 2) Iniciar curso → temario (Continuar / Certificado según el avance)
  if (variant === "detail") {
    const a = t.courses.actions;
    const buyLabel = enrolling ? a.enrolling : inCart ? a.inCart : hasAccess ? a.owned : isFree ? a.enterFree : a.buy;
    const start = () => (progress === 100 && hasAccess ? router.push(`/quiz/examen/curso/${courseId}?desde=curso`) : primaryHref && router.push(primaryHref));
    return (
      <>
        <div className="space-y-2">
          <button type="button" onClick={goPrimary} disabled={enrolling || hasAccess || inCart} aria-busy={enrolling} className={`${COURSE_CTA_CLASS} disabled:cursor-default disabled:opacity-60`}>
            {buyLabel}
          </button>
          <button type="button" onClick={start} disabled={!canStart} title={canStart ? undefined : a.startLocked} className="btn btn-outline w-full py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60">
            {primaryLabel(progress, isFree, true, a)}
          </button>
          {!canStart && <p className="type-meta text-muted-foreground">{a.startLocked}</p>}
          {/* [2026-11-06 · Examen final]: bloqueado hasta terminar el curso al 100 % → entonces lleva a su examen (aprobarlo emite el certificado) */}
          {hasAccess && progress === 100 ? (
            <Link href={`/quiz/examen/curso/${courseId}?desde=curso`} className="btn btn-primary w-full py-2.5 text-sm">📝 Presentar examen final</Link>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-3 text-sm" aria-disabled="true">
              <p className="font-semibold">🔒 Examen final</p>
              <p className="type-meta text-muted-foreground">
                Se desbloquea al terminar el curso al 100 %{hasAccess ? ` (vas en ${progress} %)` : ""}. Aprobarlo con 70 % te da el certificado.
              </p>
            </div>
          )}
        </div>
        {reactions}
      </>
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

      {reactions}
    </>
  );
}

import Link from "next/link"; // [Next.js]: navegación cliente con prefetch
import { GraduationCap, Lock } from "lucide-react"; // [Iconografía]: mismo set lucide que el resto del portal
import type { CourseResponse } from "@/types/courses";
import { courseGroupColor } from "@/types/courses";
import { BRAND } from "@/config/brand";
import { fmt, getDictionary, INTL_LOCALE } from "@aula/shared-i18n";
import { getLocale } from "@/lib/i18n-server";
import { CourseBadge } from "./CourseBadge";
import { CoursePrice } from "./CoursePrice";
import { CourseActions } from "./CourseActions";
// [crc · CourseCard]: tarjeta de curso idéntica a NeuroLearning (thumbnail con marca de agua + icono + badges, categoría/tags, instructor ★ rating · estudiantes, precio, progreso, CTA + Lab, reacciones)
// [Patrón]: Compound Component (Thumbnail privado) + Presentational | [Principio]: SRP | [Tecnología]: React Server Component asíncrono (textos traducidos en el servidor, cero JS salvo CoursePrice/CourseActions)

export interface CourseCardProps {
  course: CourseResponse;
}

// `export async function` (RSC): lee el idioma (memoizado por petición con React.cache → una sola lectura de cookie para toda la grilla)
export async function CourseCard({ course }: CourseCardProps) {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.courses; // Alias de la sección de cursos del diccionario
  // [Color del idioma]: el del curso o, si falta, el del SSOT de idiomas | `||` (JS): cae al segundo si el primero es vacío
  const color = course.color || courseGroupColor(course.group);
  const href = `/courses/${course.slug || course.id}`;
  const locked = !course.hasAccess; // De pago y sin comprar → candado sobre el thumbnail
  const languageName = dict.languageNames[course.group] ?? course.group; // `??` (ES2020): grupo legacy → código crudo

  return (
    // [Card]: borde superior de 3px con el color del idioma + hover elevado con sombra teñida (igual al original)
    // `--card-glow` (CSS custom property inline): permite a Tailwind usar el color dinámico en `hover:shadow-[…]`
    <article
      className="group overflow-hidden rounded-[14px] border border-border bg-card shadow-[var(--nl-shd)] transition-[transform,box-shadow] duration-200 hover:-translate-y-[3px] hover:shadow-[0_8px_30px_var(--card-glow)] focus-within:ring-2 focus-within:ring-ring"
      style={{ borderTop: `3px solid ${color}`, "--card-glow": `${color}22` } as React.CSSProperties} // `as React.CSSProperties` (TS): admite la custom property
    >
      <Link href={href} className="block focus-visible:outline-none" aria-label={fmt(t.card.view, { title: course.title })}>
        <Thumbnail
          color={color}
          code={course.icon || course.group}
          lab={course.lab}
          locked={locked}
          levelLabel={fmt(t.card.level, { level: course.category })}
          levelTitle={fmt(t.card.levelTitle, { level: course.category })}
          lockedLabel={t.card.locked}
        />
      </Link>

      <div className="p-3.5">
        {/* Categoría (idioma) + tags */}
        <div className="mb-1.5 flex flex-wrap gap-1">
          <CourseBadge text={languageName} color={color} size="sm" />
          {course.tags.slice(0, 3).map((tag) => (
            <CourseBadge key={tag} text={tag} color={color} size="sm" />
          ))}
        </div>

        {/* Título */}
        <Link href={href} className="block focus-visible:outline-none">
          <h3 className="mb-1 line-clamp-2 text-[13px] font-bold leading-snug text-foreground transition-colors group-hover:text-primary">
            {course.title}
          </h3>
        </Link>

        {/* Instructor ★ rating • estudiantes — mismos datos que el original | `toLocaleString` (ECMA-402): separador de miles del idioma */}
        <p className="mb-2 text-[11px] text-muted-foreground">
          {course.instructor}&nbsp; ★ {course.rating.toFixed(1)} • {course.studentsCount.toLocaleString(INTL_LOCALE[locale])} {t.card.students}
        </p>

        {/* Precio (Client Component: botón "Aplicar" ProBono) */}
        <CoursePrice
          price={course.price}
          originalPrice={course.originalPrice}
          isFree={course.isFree}
          tokens={course.tokens}
          discountPercent={course.discountPercent}
          isProBono={course.isProBono}
          currency={course.currency}
          color={color}
        />

        {/* Barra de progreso | role="progressbar" + aria-valuenow → accesible */}
        <div
          className="mt-1 h-1.5 overflow-hidden rounded-full"
          style={{ background: `${color}22` }}
          role="progressbar"
          aria-valuenow={course.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={fmt(t.card.progress, { pct: course.progress })}
        >
          <div className="h-full rounded-full transition-[width] duration-1000" style={{ width: `${course.progress}%`, background: color }} />
        </div>

        {/* CTA dinámica + Lab + reacciones (Client Component con Optimistic UI) */}
        <CourseActions
          courseId={course.id}
          progress={course.progress}
          isFree={course.isFree}
          hasAccess={course.hasAccess}
          color={color}
          lab={course.lab}
          initialFavorite={course.isFavorite}
          initialLike={course.likeOn}
          initialLove={course.loveOn}
          primaryHref={href}
          variant="card"
          purchase={{ title: course.title, price: course.price, currency: course.currency }} // [Carrito]: datos para "Comprar"
        />
      </div>
    </article>
  );
}

// ── Thumbnail ──
interface ThumbnailProps {
  color: string; // Color del idioma
  code: string; // Código ISO del idioma (EN, FR…) dibujado en el icono central
  lab: string | null; // Laboratorio asociado (badge superior izquierdo)
  locked: boolean; // Curso bloqueado (de pago y sin progreso)
  levelLabel: string; // Texto traducido del badge ("Nivel B1")
  levelTitle: string; // Tooltip traducido ("Nivel MCER B1")
  lockedLabel: string; // Texto accesible del candado
}

// [Thumbnail]: subcomponente presentacional privado del Compound CourseCard | [Paradigma]: Funcional + Declarativo
function Thumbnail({ color, code, lab, locked, levelLabel, levelTitle, lockedLabel }: ThumbnailProps) {
  return (
    <div
      className="relative flex h-[100px] items-center justify-center overflow-hidden rounded-t-[10px]"
      style={{ background: `${color}22`, borderBottom: `1px solid ${color}22` }}
    >
      {/* Marca de agua (decorativa) */}
      <div
        className="absolute inset-0 flex items-center justify-center p-1 text-center font-mono text-[10px] tracking-[-1px] opacity-10"
        style={{ color }}
        aria-hidden
      >
        {BRAND.name}
      </div>

      {/* Icono central SVG del original (círculos + cruz) con el código del idioma en el centro */}
      <svg width="40" height="40" viewBox="0 0 40 40" className="opacity-70" aria-hidden>
        <circle cx="20" cy="20" r="18" fill={`${color}22`} stroke={color} strokeWidth="1.5" />
        <circle cx="20" cy="20" r="10" fill={`${color}44`} />
        <line x1="20" y1="2" x2="20" y2="8" stroke={color} strokeWidth="1.2" />
        <line x1="20" y1="32" x2="20" y2="38" stroke={color} strokeWidth="1.2" />
        <line x1="2" y1="20" x2="8" y2="20" stroke={color} strokeWidth="1.2" />
        <line x1="32" y1="20" x2="38" y2="20" stroke={color} strokeWidth="1.2" />
        <text x="20" y="23.5" textAnchor="middle" fontSize="9" fontWeight="800" fontFamily="monospace" fill={color}>
          {code}
        </text>
      </svg>

      {/* Badge superior derecho: nivel MCER (equivale al "Eje N" del original) */}
      <span
        title={levelTitle}
        className="absolute right-2 top-2 rounded-md px-2 py-0.5 text-[9px] font-bold text-white"
        style={{ background: `${color}CC` }}
      >
        <GraduationCap aria-hidden className="inline size-4 align-[-0.125em]" /> {levelLabel}
      </span>

      {/* Badge superior izquierdo: laboratorio, si el curso tiene uno */}
      {lab && (
        <span
          className="absolute left-2 top-2 rounded-md px-[7px] py-0.5 text-[9px] font-bold"
          style={{ background: "rgba(10,10,26,.7)", border: `1px solid ${color}66`, color }}
        >
          {lab}
        </span>
      )}

      {/* Etiqueta de candado (curso de pago sin comprar): pill en la esquina en vez de un velo negro sobre toda la miniatura → el idioma y el nivel siguen visibles y la grilla no se ve «apagada» | [UX]: jerarquía visual */}
      {locked && (
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-[rgba(10,10,26,.72)] px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
          <Lock className="size-3" aria-hidden />
          {lockedLabel}
        </span>
      )}
    </div>
  );
}

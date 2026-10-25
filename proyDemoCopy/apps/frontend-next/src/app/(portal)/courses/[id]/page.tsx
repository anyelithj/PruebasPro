import { Markdown } from "@/components/shared/Markdown"; // [2026-10-23]: la descripción puede venir en Markdown (IA / importación)
import { Star } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis)
import { BackLink } from "@/components/shared/BackLink"; // [2026-10-23]: enlace «volver» uniforme (icono + texto)
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCourse, listCourseMaterials } from "@/lib/courses-api";
import { getCourseOutline } from "@/lib/curriculum-api"; // [Etapa 3]: estructura del curso + progreso del usuario
import { CourseTimeline } from "@/components/courses/CourseTimeline"; // [Línea de tiempo]: siguiente lección destacada
import { getCurrentUserPayload } from "@/lib/auth";
import { Role } from "@/lib/constants";
import { CourseMaterials } from "@/components/courses/CourseMaterials"; // [Temario del curso]: lecciones (video/PDF/imagen) con estado Completado/En curso/Bloqueado
import { CourseBadge } from "@/components/courses/CourseBadge";
import { CoursePrice } from "@/components/courses/CoursePrice";
import { CourseActions } from "@/components/courses/CourseActions";
import { ApiError } from "@/lib/errors";
import { courseGroupLabel } from "@/types/courses";
import { BRAND } from "@/config/brand";
import { getServerDictionary } from "@/lib/i18n-server";
// [Página /courses/:id]: SSR detalle + generateMetadata + OG + JSON-LD | [Patrón]: Container | [Principio]: SRP

interface PageProps {
  params: Promise<{ id: string }>;
}

// [generateMetadata]: SEO dinámico por curso | [Patrón]: Decorator (Metadata API)
export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { id } = await props.params;
  try {
    const c = await getCourse(id);
    return {
      title: `${c.title}`,
      description: c.shortDescription,
      robots: { index: false, follow: false },
      openGraph: {
        title: c.title,
        description: c.shortDescription,
        type: "article",
      },
    };
  } catch {
    return { title: "Curso no encontrado" };
  }
}

const GOLD = "#D4A017";

export default async function CourseDetailPage(props: PageProps) {
  const { id } = await props.params;
  let course;
  try {
    course = await getCourse(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  // [Métricas reales]: solo se muestran valoración/alumnos/horas si existen datos (> 0); nada derivado artificialmente | [Principio]: Honestidad de datos
  const hasRatings = course.studentsCount > 0;

  // [JSON-LD]: schema Course para buscadores | [Principio]: SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description: course.description || course.shortDescription,
    provider: {
      "@type": "Organization",
      name: BRAND.name,
    },
    educationalLevel: course.level,
    inLanguage: course.icon.toLowerCase(), // Código ISO 639-1 del idioma del curso (schema.org)
    // Spread condicional (ES2018): solo incluye la propiedad si hay dato real
    ...(course.durationHours > 0 ? { timeRequired: `PT${course.durationHours}H` } : {}),
    offers: {
      "@type": "Offer",
      price: course.price,
      priceCurrency: course.currency,
      availability: course.isPublished
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
    // [SEO válido]: Google rechaza AggregateRating con 0 reseñas → se omite sin datos
    ...(hasRatings
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: course.rating,
            reviewCount: course.studentsCount,
          },
        }
      : {}),
  };

  // [Carga en paralelo]: materiales, rol y textos | `.catch(() => [])`: sin acceso (403) o sin materiales no se rompe la página
  // `.catch(() => null)`: sin estructura (curso antiguo o backend sin la Etapa 3) la página sigue igual que antes
  const [materials, user, t, outline] = await Promise.all([listCourseMaterials(course.id).catch(() => []), getCurrentUserPayload(), getServerDictionary(), getCourseOutline(course.id).catch(() => null)]);
  const isAdmin = user?.role === Role.ADMIN;
  // [Acceso al material]: comprado, inscrito (gratis) o ADMIN | la autorización REAL la hace el backend al servir cada archivo (403) | [Seguridad]: la UI solo refleja
  const canSee = Boolean(course.hasAccess) || isAdmin; // `Boolean()`: tolera un backend sin el campo

  return (
    <div className="fade-in w-full space-y-5 py-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Back link */}
      <BackLink href="/courses" memo="catalog">Volver a cursos</BackLink>

      {/* HERO CARD */}
      <section
        className="rounded-2xl p-5"
        style={{
          background: "var(--nl-surf)",
          border: "1px solid var(--nl-brd)",
          borderTop: `3px solid ${course.color}`,
          boxShadow: "var(--nl-shd)",
        }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
          <div
            className="flex items-center gap-2 text-xs"
            style={{ color: "var(--nl-txt2)" }}
          >
            <span aria-hidden className="font-mono font-bold">{course.icon}</span>
            <span>{courseGroupLabel(course.group)}</span>
            <span>·</span>
            <span>{course.level}</span>
            {course.durationHours > 0 && (
              <>
                <span>·</span>
                <span>{course.durationHours} h</span>
              </>
            )}
            {course.modality && (
              <>
                <span>·</span>
                <span>{course.modality}</span>
              </>
            )}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {course.tags.map((tag) => (
              <CourseBadge key={tag} text={tag} color={course.color} size="sm" />
            ))}
          </div>
        </div>

        <h1
          className="text-[22px] font-bold mb-2"
          style={{ color: "var(--nl-txt)" }}
        >
          {course.title}
        </h1>
        <p className="text-xs mb-3" style={{ color: "var(--nl-txt2)" }}>
          {course.shortDescription}
        </p>

        {/* Stats row */}
        <div
          className="flex items-center gap-4 flex-wrap text-xs"
          style={{ color: "var(--nl-txt2)" }}
        >
          {hasRatings && (
            <span className="flex items-center gap-1">
              <span aria-hidden style={{ color: GOLD }}>
                ★
              </span>
              <strong style={{ color: "var(--nl-txt)" }}>
                {course.rating.toFixed(1)}
              </strong>
              <span>· {course.studentsCount.toLocaleString("es-CO")} estudiantes</span>
            </span>
          )}
          {course.isPublished && (
            <span className="flex items-center gap-1">
              <span aria-hidden>●</span> Publicado
            </span>
          )}
          {course.isProBono && (
            <span className="flex items-center gap-1">
              <Star aria-hidden className="inline size-4 align-[-0.125em]" /> Beca ProBono disponible
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div
            className="flex items-center justify-between text-[11px] mb-1.5"
            style={{ color: "var(--nl-txt2)" }}
          >
            <span>Tu progreso</span>
            <span className="font-bold eeg-mono" style={{ color: course.color }}>
              {course.progress}%
            </span>
          </div>
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ background: `${course.color}22` }}
            role="progressbar"
            aria-valuenow={course.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progreso del curso"
          >
            <div
              className="h-full transition-[width] duration-1000"
              style={{ width: `${course.progress}%`, background: course.color }}
            />
          </div>
        </div>
      </section>

      {/* Descripción + Instructor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <article
          className="rounded-2xl p-5"
          style={{
            background: "var(--nl-surf)",
            border: "1px solid var(--nl-brd)",
            boxShadow: "var(--nl-shd)",
          }}
        >
          <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--nl-txt)" }}>
            Descripción
          </h2>
          <Markdown text={course.description || course.shortDescription} className="text-xs leading-relaxed text-[var(--nl-txt2)]" />
        </article>

        <article
          className="rounded-2xl p-5"
          style={{
            background: "var(--nl-surf)",
            border: "1px solid var(--nl-brd)",
            boxShadow: "var(--nl-shd)",
          }}
        >
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--nl-txt)" }}>
            Autoría del contenido
          </h2>
          <div className="flex items-start gap-3">
            <div
              className="w-12 h-12 rounded-full shrink-0 flex items-center justify-center text-xl font-bold"
              style={{
                background: `${course.color}22`,
                border: `2px solid ${course.color}66`,
                color: course.color,
              }}
              aria-hidden
            >
              {course.instructor.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="text-[13px] font-bold mb-0.5"
                style={{ color: "var(--nl-txt)" }}
              >
                {course.instructor}
              </div>
              <div className="text-[11px]" style={{ color: "var(--nl-txt2)" }}>
                {course.instructorTitle ?? `Material curado en ${BRAND.name}`}
              </div>
            </div>
          </div>
        </article>
      </div>

      {/* Compra / Acceso card */}
      <section
        className="rounded-2xl p-5"
        style={{
          background: "var(--nl-surf)",
          border: "1px solid var(--nl-brd)",
          boxShadow: "var(--nl-shd)",
        }}
      >
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--nl-txt)" }}>
          Acceso al curso
        </h2>
        <CoursePrice
          price={course.price}
          originalPrice={course.originalPrice}
          isFree={course.isFree}
          tokens={course.tokens}
          discountPercent={course.discountPercent}
          isProBono={course.isProBono}
          currency={course.currency}
          color={course.color}
        />
        <CourseActions
          courseId={course.id}
          progress={course.progress}
          isFree={course.isFree}
          hasAccess={course.hasAccess}
          color={course.color}
          primaryHref="#materials-title" // Con acceso: baja al material
          purchase={{ title: course.title, price: course.price, currency: course.currency }} // Sin acceso: "Comprar" → carrito
          initialFavorite={course.isFavorite}
          initialLike={course.likeOn}
          initialLove={course.loveOn}
          variant="detail"
        />
      </section>

      {/* [Ruta del curso]: línea de tiempo Nivel → Módulo → Unidad → Lección; docente/admin pueden editarla */}
      {outline && (outline.summary.lessons > 0 || user?.role !== Role.USER) && (
        <CourseTimeline courseId={course.id} outline={outline} canEdit={user?.role === Role.ADMIN || user?.role === Role.TEACHER} />
      )}

      {/* [Temario del curso]: lecciones visibles solo tras comprar (o si es gratis); el ADMIN puede adjuntar o quitar aquí mismo */}
      {canSee ? (
        <CourseMaterials courseId={course.id} initial={materials} initialCompleted={course.completedMaterialIds ?? []} canTrack={course.hasAccess} canManage={isAdmin} color={course.color} />
      ) : (
        <section aria-labelledby="materials-title" className="surface space-y-2 p-5 text-center">
          <h2 id="materials-title" className="text-base font-bold">
            {t.courses.materials.title}
          </h2>
          <p className="text-sm text-muted-foreground">{t.courses.materials.locked}</p>
        </section>
      )}
    </div>
  );
}

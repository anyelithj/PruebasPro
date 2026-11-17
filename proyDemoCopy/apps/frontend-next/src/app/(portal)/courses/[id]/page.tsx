import { getExamManage } from "@/lib/quiz-api";
import { CourseExamBanner } from "../../admin/certificados/CourseExamBanner"; // [2026-11-10]: estado del examen final en el borrador
import { Markdown } from "@/components/shared/Markdown"; // [2026-10-23]: la descripción puede venir en Markdown (IA / importación)
import { GraduationCap, Star } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis)
import { BackLink } from "@/components/shared/BackLink"; // [2026-10-23]: enlace «volver» uniforme (icono + texto)
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCourse, listCourseMaterials } from "@/lib/courses-api";
import { getCourseOutline } from "@/lib/curriculum-api"; // [Etapa 3]: estructura del curso + progreso del usuario
import { CourseTimeline } from "@/components/courses/CourseTimeline"; // [Línea de tiempo]: siguiente lección destacada
import { getCurrentUserPayload } from "@/lib/auth";
import { Role } from "@/lib/constants";
import { COURSE_ASIDE_SLOT, CourseMaterials } from "@/components/courses/CourseMaterials"; // [Temario del curso]: lecciones (video/PDF/imagen) con estado Completado/En curso/Bloqueado
import { CourseBadge } from "@/components/courses/CourseBadge";
import { CourseSyllabus } from "@/components/courses/CourseSyllabus"; // [2026-10-25]: temario = subtemas con su explicación
import { parseSyllabus } from "@/lib/syllabus";
import { canManageCourse } from "@/lib/course-access"; // [2026-10-27]: ADMIN o docente dueño (espejo de la policy del backend)
import { CoursePrice } from "@/components/courses/CoursePrice";
import { CourseActions } from "@/components/courses/CourseActions";
import { ApiError } from "@/lib/errors";
import { courseGroupLabel } from "@/types/courses";
import { BRAND } from "@/config/brand";
import { getServerDictionary } from "@/lib/i18n-server";
import { RowActions } from "@/components/admin/RowActions";
import { SocialLinks } from "@/components/shared/SocialLinks"; // [2026-10-28]: redes del docente en «Autoría del contenido»
import { courseProgress } from "@/lib/course-progress"; // [2026-10-28]: cálculo único del progreso
import { deleteCourseAction, setCoursePublishedAction } from "@/app/(portal)/admin/courses/actions";
import { DetailHeader, ToneBadge } from "@/components/shared/DetailHeader"; // [2026-11-16]: cabecera de Gestión uniforme
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
  const canManage = canManageCourse(course, user); // [2026-10-27]: ADMIN o el docente que creó el curso → barra de revisión/publicación y gestión del material
  // [2026-11-10]: «Publicar» bloqueado hasta que exista el examen final (NestJS lo exige también)
  const hasExam = canManage ? Boolean((await getExamManage().catch(() => [])).find((r) => r.courseId === course.id)?.quizId) : false;
  // [Acceso al material]: comprado, inscrito (gratis) o ADMIN | la autorización REAL la hace el backend al servir cada archivo (403) | [Seguridad]: la UI solo refleja
  const canSee = Boolean(course.hasAccess) || canManage; // `Boolean()`: tolera un backend sin el campo | [2026-10-27]: el docente dueño también ve su material
  const isStaff = isAdmin || user?.role === Role.TEACHER;
  // [Progreso real · 2026-10-25]: recursos vistos + lecciones de la ruta completadas (antes solo contaban los recursos → al avanzar en la ruta la barra no se movía)
  // [2026-10-25]: + subtemas del temario estudiados
  const topics = parseSyllabus(course.content);
  // [Fix 2026-10-28]: misma fórmula que la página de la lección (SSOT `courseProgress`) → no cuenta recursos borrados ni subtemas renombrados | [Principio]: DRY
  const summary = courseProgress({
    materialIds: materials.map((m) => m.id),
    doneMaterials: course.completedMaterialIds ?? [],
    topicTitles: topics.map((x) => x.title),
    doneTopics: course.completedTopics ?? [],
    lessons: outline ? { done: outline.summary.completed, total: outline.summary.lessons } : undefined, // `?:` ternario → sin ruta no suma lecciones
  });
  const progress = summary.total ? summary.pct : course.progress; // Sin unidades medibles → el % guardado por el backend

  return (
    <div className="fade-in w-full space-y-5 py-4">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Back link */}
      <BackLink href="/courses" memo="catalog">Volver a cursos</BackLink>

      {/* [Revisión · 2026-10-25]: el ADMIN (o el docente dueño) revisa el curso tal como lo verá el estudiante y lo publica aquí
          [2026-11-16]: MISMA cabecera que el detalle de Recursos/Actividades/Exámenes (DetailHeader: icono · título · datos · acciones) — sin la lista de pasos */}
      {canManage && (
        <DetailHeader
          icon={<GraduationCap className="size-8" />}
          title={course.title}
          meta={
            <>
              Curso · {courseGroupLabel(course.group)} · {course.level} · <ToneBadge tone={course.isPublished ? "brand" : "warning"}>{course.isPublished ? "Publicado" : "Borrador"}</ToneBadge>
            </>
          }
          actions={
            <>
              <RowActions
                title={course.title}
                // [Ver]: abre el primer recurso como estudiante; sin recursos, baja al temario de esta misma página
                tryHref={materials[0] ? `/courses/${course.id}/lessons/${materials[0].id}` : "#syllabus-title"}
                editHref={`/admin/courses/${course.id}/edit`}
                publish={{ isPublished: course.isPublished, toggle: setCoursePublishedAction.bind(null, course.id, !course.isPublished), blocked: hasExam ? undefined : "Crea primero el examen final del curso" }}
                onDelete={deleteCourseAction.bind(null, course.id)}
                afterDeleteHref="/admin/courses"
                deleteTitle={`Eliminar «${course.title}»`}
              />
              {/* [2026-11-09]: «Crear examen» junto a Publicar/Editar → formulario de examen con los datos y subtemas del curso */}
              {!hasExam && (
                <Link href={`/quiz/create?curso=${encodeURIComponent(course.id)}`} className="btn btn-outline btn-sm">
                  Crear examen
                </Link>
              )}
            </>
          }
        />
      )}
      {canManage && <CourseExamBanner courseId={course.id} />}

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
          className="title-page mb-2"
          style={{ color: "var(--nl-txt)" }}
        >
          {course.title}
        </h1>
        <p className="type-meta mb-3" style={{ color: "var(--nl-txt2)" }}>
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
              {progress}%
            </span>
          </div>
          <div
            className="h-2 rounded-full overflow-hidden"
            style={{ background: `${course.color}22` }}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progreso del curso"
          >
            <div
              className="h-full transition-[width] duration-1000"
              style={{ width: `${progress}%`, background: course.color }}
            />
          </div>
        </div>
      </section>

      {/* [Organización · 2026-10-27]: 2 columnas en escritorio → contenido del curso (Presentación → Temario → Ruta → Materiales adicionales) a la izquierda y «Autoría» + «Acceso al curso» fijos a la derecha (2026-10-28: la autoría va primero)
          `lg:grid-cols-[minmax(0,1fr)_320px]` (Tailwind arbitrary value): `minmax(0,1fr)` evita que un PDF/tabla ancha desborde la columna | en móvil se apila: cabecera → autoría → acceso → contenido */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        {/* [Columna lateral]: va PRIMERO en el DOM (orden de lectura y de foco = orden visual en móvil) y en escritorio se coloca a la derecha con `lg:col-start-2 lg:row-start-1` | `lg:sticky`: acompaña el scroll */}
        <aside aria-label="Instructor y acceso al curso" className="space-y-4 lg:col-start-2 lg:row-start-1">
          {/* [1 · Autoría · 2026-10-28]: va PRIMERO en la columna lateral (antes bajo el acceso) → quién enseña antes de cuánto cuesta | resumen del perfil del docente (bio) + sus redes
              `course.author` (TS opcional): solo cursos con docente dueño; los antiguos/semilla muestran el nombre y el cargo como antes | [Principio]: Least Privilege (el backend no envía email) */}
          <section
            aria-labelledby="author-title"
            className="rounded-2xl p-5"
            style={{
              background: "var(--nl-surf)",
              border: "1px solid var(--nl-brd)",
              boxShadow: "var(--nl-shd)",
            }}
          >
            <h2 id="author-title" className="title-section mb-3" style={{ color: "var(--nl-txt)" }}>
              Instructor
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
                <div className="text-[13px] font-bold mb-0.5 break-words" style={{ color: "var(--nl-txt)" }}>
                  {course.instructor}
                </div>
                <div className="text-[11px]" style={{ color: "var(--nl-txt2)" }}>
                  {course.instructorTitle ?? `Material curado en ${BRAND.name}`}
                </div>
              </div>
            </div>
            {/* [Bio]: texto plano (máx. 300 caracteres, lo limita el perfil) | `whitespace-pre-line` (Tailwind): respeta los saltos de línea que escribió el docente | `?.trim()` (ES2020): sin bio → no se pinta */}
            {course.author?.bio?.trim() && (
              <p className="mt-3 whitespace-pre-line break-words text-xs leading-relaxed" style={{ color: "var(--nl-txt2)" }}>
                {course.author.bio}
              </p>
            )}
            {/* [Sin perfil · 2026-10-30]: en vez de un hueco, se dice qué falta; quien gestiona el curso va directo a completarlo */}
            {!course.author?.bio?.trim() && !Object.values(course.author?.social ?? {}).some(Boolean) && (
              <p className="mt-3 text-xs" style={{ color: "var(--nl-txt2)" }}>
                El docente aún no ha completado su perfil.
              </p>
            )}
            {/* [Redes · Fix 2026-10-31]: LinkedIn · X · Spotify · YouTube SIEMPRE visibles (antes se ocultaban sin datos y ningún docente las tiene aún): configuradas = enlace; sin configurar = atenuadas | `?.` (ES2020): cursos sin dueño también | [Patrón]: Reutilización (components/shared/SocialLinks) */}
            <div className="mt-3">
              <SocialLinks links={course.author?.social} owner={course.author?.name || course.instructor} color={course.color} showEmpty /> {/* [2026-11-05]: red sin enlace = icono bloqueado (antes llevaba al perfil) */}
            </div>
          </section>

          {/* [2 · Acceso al curso]: precio + acciones, bajo la autoría | `aria-labelledby`: la región se anuncia con su título */}
          <section
            aria-labelledby="access-title"
            className="rounded-2xl p-5"
            style={{
              background: "var(--nl-surf)",
              border: "1px solid var(--nl-brd)",
              borderTop: `3px solid ${course.color}`,
              boxShadow: "var(--nl-shd)",
            }}
          >
            <h2 id="access-title" className="title-section mb-3" style={{ color: "var(--nl-txt)" }}>
              Acceso al curso
            </h2>
            {/* [Etiquetas · 2026-11-02]: temas que trabaja el curso + instructor ★ valoración • estudiantes (como la tarjeta del catálogo) */}
            <div className="mb-2 flex flex-wrap gap-1" aria-label="Etiquetas del curso">
              <CourseBadge text={courseGroupLabel(course.group)} color={course.color} size="sm" />
              {course.tags.map((tag) => (
                <CourseBadge key={tag} text={tag} color={course.color} size="sm" />
              ))}
            </div>
            <p className="mb-3 type-meta" style={{ color: "var(--nl-txt2)" }}>
              {course.instructor}&nbsp; ★ {course.rating.toFixed(1)} • {course.studentsCount.toLocaleString("es-CO")} est.
            </p>
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
              progress={progress}
              isFree={course.isFree}
              hasAccess={course.hasAccess}
              canStart={canSee} // [2026-11-04]: el ADMIN o el docente dueño también entran al temario con «Iniciar curso»
              color={course.color}
              // [2026-11-04]: «Iniciar curso» → SIEMPRE la página del TEMARIO (ruta propia; desde ahí «Materiales adicionales →») · sin acceso → comprar/inscribirse
              primaryHref={`/courses/${encodeURIComponent(course.id)}/temario`}
              purchase={{ title: course.title, price: course.price, currency: course.currency }} // Sin acceso: "Comprar" → carrito
              engagement={{ isFavorite: course.isFavorite, reaction: course.reaction, likesCount: course.likesCount, lovesCount: course.lovesCount }} // [Caso F]: ⭐ + 👍/❤️ + conteos
              variant="detail"
            />
          </section>
          {/* [Hueco · 2026-10-30]: «Resumen» y «Gestionar material» (estado en CourseMaterials, createPortal) van bajo «Acceso al curso» */}
          <div id={COURSE_ASIDE_SLOT} className="space-y-4" />
        </aside>

        {/* [Columna principal]: el contenido en el orden en que se estudia | `min-w-0`: los hijos pueden encoger (texto largo, visores) */}
        <div className="min-w-0 space-y-5 lg:col-start-1 lg:row-start-1">
          {/* [1 · Presentación]: descripción + objetivos + público */}
          <article
            aria-labelledby="about-title"
            className="rounded-2xl p-5"
            style={{
              background: "var(--nl-surf)",
              border: "1px solid var(--nl-brd)",
              boxShadow: "var(--nl-shd)",
            }}
          >
            <h2 id="about-title" className="title-section mb-2" style={{ color: "var(--nl-txt)" }}>
              Presentación
            </h2>
            <Markdown text={course.description || course.shortDescription} className="text-xs leading-relaxed text-[var(--nl-txt2)]" />
            {/* [Ficha · 2026-10-25]: objetivos y público en su sitio (antes la IA los mezclaba con el temario) | [2026-10-27]: en 2 columnas cuando hay espacio */}
            {(course.objectives?.trim() || course.audience?.trim()) && (
              <div className="mt-4 grid grid-cols-1 gap-4 border-t border-border pt-4 md:grid-cols-2">
                {course.objectives?.trim() && (
                  <div>
                    <h3 className="title-card mb-1 text-[var(--nl-txt)]">Objetivos</h3>
                    <Markdown text={course.objectives} className="text-xs leading-relaxed text-[var(--nl-txt2)]" />
                  </div>
                )}
                {course.audience?.trim() && (
                  <div>
                    <h3 className="title-card mb-1 text-[var(--nl-txt)]">A quién va dirigido</h3>
                    <Markdown text={course.audience} className="text-xs leading-relaxed text-[var(--nl-txt2)]" />
                  </div>
                )}
              </div>
            )}
          </article>

          {/* [2 · Temario]: subtemas (bloqueados hasta iniciar el curso · el personal los ve siempre) · cada uno se marca «Estudiado» → progreso | se oculta si el curso no tiene contenido */}
          <CourseSyllabus courseId={course.id} content={course.content} completed={course.completedTopics ?? []} locked={!canSee && !isStaff} canTrack={Boolean(course.hasAccess)} color={course.color} lang={course.icon.toLowerCase()} />

          {/* [3 · Ruta del curso]: línea de tiempo Nivel → Módulo → Unidad → Lección; docente/admin pueden editarla */}
          {outline && (outline.summary.lessons > 0 || user?.role !== Role.USER) && (
            <CourseTimeline courseId={course.id} outline={outline} />
          )}

          {/* [4 · Materiales adicionales · 2026-10-28]: antes «Recursos» | ocupa el mismo ancho que «Ruta del curso» (columna principal completa) | videos/PDF/imágenes, visibles solo tras comprar (o si es gratis); el ADMIN puede adjuntar o quitar aquí mismo */}
          {canSee ? (
            <CourseMaterials courseId={course.id} initial={materials} initialCompleted={course.completedMaterialIds ?? []} canTrack={course.hasAccess} canManage={canManage} color={course.color} />
          ) : (
            <section aria-labelledby="materials-title" className="surface space-y-2 p-5 text-center">
              <h2 id="materials-title" className="title-section">
                {t.courses.materials.title}
              </h2>
              <p className="text-muted-foreground">{t.courses.materials.locked}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

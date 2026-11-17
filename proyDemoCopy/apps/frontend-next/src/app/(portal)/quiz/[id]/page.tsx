import { BackLink } from "@/components/shared/BackLink"; // [2026-10-23]: enlace «volver» uniforme (icono + texto)
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Pencil, Play } from "lucide-react"; // [2026-10-28]: icono SVG de Exámenes (mismo que la pestaña de Gestión) en vez del emoji de categoría
import { getQuiz } from "@/lib/quiz-api";
import { DifficultyBadge } from "@/components/quiz/DifficultyBadge";
import { QuizActions } from "@/components/quiz/QuizActions";
import { DetailHeader, ToneBadge } from "@/components/shared/DetailHeader"; // [2026-10-28]: MISMA cabecera que el tema de Recursos
import { getCurrentUserRole } from "@/lib/auth";
import { Role } from "@/lib/constants";
import { categoryLabel } from "@/lib/categories";
import { languageLabel } from "@/lib/languages";
import { stripMarkup } from "@/lib/strip-markup";
import type { QuestionPublic, QuestionWithAnswer } from "@/types/quiz";
// [QuizDetailPage]: SSR detail rol-aware — alumno ve "Iniciar examen"; docente/admin ve el DETALLE de Gestión: estado (Borrador/Publicado), acciones y preguntas en tarjetas
// [2026-10-28]: tras «Crear examen» se llega AQUÍ (el examen nace en Borrador) → misma disposición que /admin/curriculum/tema: BackLink, cabecera `surface` con icono,
// línea de datos con el estado y RowActions (Editar · Publicar · Eliminar con toast + Dialog) a la derecha, y lista corrida de preguntas (2026-10-31: sin tarjetas)
// [Patrón]: Container (RSC) + Role-based Render + Composition (DetailHeader) | [Principio]: SRP + DRY + Least Privilege | [Paradigma]: RSC + async

export async function generateMetadata(props: {
  params: Promise<{ id: string }>; // [Next.js 16]: `params` es una Promise
}): Promise<Metadata> {
  const { id } = await props.params;
  try {
    const quiz = await getQuiz(id);
    return {
      title: quiz.title,
      description: quiz.description ?? `Quiz de ${quiz.category}`,
      robots: { index: false, follow: false },
    };
  } catch {
    return { title: "Quiz" };
  }
}

export const dynamic = "force-dynamic"; // [2026-10-28]: el estado (Borrador/Publicado) cambia con «Publicar» → siempre el actual

export default async function QuizDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  let quiz;
  try {
    quiz = await getQuiz(id);
  } catch {
    notFound(); // `never` (TS): corta el flujo → `quiz` queda asignado después
  }

  const role = await getCurrentUserRole();
  const isManager = role === Role.TEACHER || role === Role.ADMIN;
  // [Lista de Gestión]: admin → pestaña Exámenes de /admin/users · docente → /teacher/quizzes · alumno → catálogo /quiz (BackLink usa además el «memo» del listado)
  const listHref = role === Role.ADMIN ? "/admin/users?tab=examenes" : role === Role.TEACHER ? "/teacher/quizzes" : "/quiz";
  // `QuestionPublic & Partial<…>` (TS): el backend añade `correctAnswer` solo para manager → opcional
  const questions: Array<QuestionPublic & Partial<Pick<QuestionWithAnswer, "correctAnswer">>> = quiz.questions ?? [];
  const questionCount = questions.length;
  const estimatedMinutes = Math.ceil((questionCount * quiz.timePerQuestionSeconds) / 60);
  const editHref = `/quiz/${quiz.id}/edit`;

  return (
    <div className="w-full space-y-5 py-4">
      {/* [2026-11-11]: examen final de un curso → vuelve a ESE curso (se llega desde su borrador para publicarlo) */}
      {quiz.kind === "final" && quiz.courseId ? (
        <BackLink href={`/courses/${encodeURIComponent(quiz.courseId)}`}>Volver al curso</BackLink>
      ) : (
        <BackLink href={listHref} memo="exams">Volver a exámenes</BackLink>
      )}

      {/* [Cabecera]: DetailHeader (pieza compartida con Recursos y Actividades) | datos: categoría · idioma · dificultad · N preguntas · tiempo · estado */}
      <DetailHeader
        icon={<FileText className="size-8" />}
        title={quiz.title}
        meta={
          <>
            {categoryLabel(quiz.category)} · {quiz.language ? languageLabel(quiz.language) : "—"} · <DifficultyBadge difficulty={quiz.difficulty} /> · <b>{questionCount}</b> preguntas · {quiz.timePerQuestionSeconds}s/preg. · ~{estimatedMinutes} min
            {/* [Estado]: solo Gestión — el alumno solo ve exámenes publicados */}
            {isManager && (
              <>
                {" "}· <ToneBadge tone={quiz.isPublished ? "brand" : "warning"}>{quiz.isPublished ? "Publicado" : "Borrador"}</ToneBadge>
              </>
            )}
          </>
        }
        actions={
          isManager ? (
            // [Acciones]: MISMO componente que la tabla: Probar · Editar · Publicar · Eliminar (toast + Dialog) | tras eliminar → lista de Gestión
            <QuizActions quizId={quiz.id} title={quiz.title} isPublished={quiz.isPublished} afterDeleteHref={listHref} />
          ) : (
            <Link href={`/quiz/${quiz.id}/play`} className="btn btn-primary">
              <Play aria-hidden className="size-4" /> Iniciar examen
            </Link>
          )
        }
      >
        {quiz.description && <p className="mt-1 text-muted-foreground">{quiz.description}</p>}
      </DetailHeader>

      {/* [Aviso de borrador]: explica el siguiente paso tras crearlo (no solo el color de la insignia) | role="status" → lo anuncian los lectores de pantalla */}
      {isManager && !quiz.isPublished && (
        <p role="status" className="rounded-lg border border-tone-warning-line bg-tone-warning-soft px-4 py-3 text-tone-warning">
          Borrador: los estudiantes aún no lo ven. Revisa las preguntas y pulsa «Publicar» cuando esté listo.
        </p>
      )}

      {/* [Vista docente/admin · Fix 2026-10-31]: preguntas en una lista corrida (antes tarjetas) bajo la misma cabecera | <ol> (HTML): el lector anuncia «lista, N elementos» | [Principio]: Least Privilege (el alumno no ve respuestas) */}
      {isManager &&
        (questionCount === 0 ? (
          <p className="surface p-6 text-muted-foreground">
            Este examen no tiene preguntas.{" "}
            <Link href={editHref} className="font-semibold text-primary hover:underline">
              Añadir preguntas
            </Link>
          </p>
        ) : (
          <ol aria-label="Preguntas del examen" className="surface divide-y divide-border">
            {questions.map((q, idx) => (
              <li key={q.id} lang={quiz.language} className="space-y-2 p-4 text-sm">
                {/* `flex-wrap`: en móvil la dificultad y «Editar» bajan de línea sin desbordar */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 font-semibold">
                    {idx + 1}. {stripMarkup(q.text)}
                  </p>
                  <DifficultyBadge difficulty={q.difficulty} />
                  {/* [2026-11-16]: «Editar» como icono (lápiz) · el nombre queda en aria-label y title */}
                  <Link href={editHref} className="btn btn-outline btn-sm size-8 px-0!" aria-label={`Editar: pregunta ${idx + 1}`} title="Editar">
                    <Pencil aria-hidden className="size-4" />
                  </Link>
                </div>
                {q.options && q.options.length > 0 && (
                  <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                    {q.options.map((opt, i) => (
                      <li key={i}>{stripMarkup(opt)}</li>
                    ))}
                  </ul>
                )}
                <p className="type-meta">
                  <span className="font-semibold text-tone-brand">Respuesta correcta: </span>
                  <span className="font-mono">{q.correctAnswer ? stripMarkup(q.correctAnswer) : "—"}</span> {/* `||`: vacío o ausente (alumno) → guion */}
                </p>
                {q.explanation && (
                  <p className="type-meta text-muted-foreground">
                    <span className="font-semibold text-foreground">Explicación: </span>
                    {q.explanation}
                  </p>
                )}
                {q.feedback && (
                  <p className="type-meta text-muted-foreground">
                    <span className="font-semibold text-foreground">Feedback pedagógico: </span>
                    {q.feedback}
                  </p>
                )}
              </li>
            ))}
          </ol>
        ))}
    </div>
  );
}

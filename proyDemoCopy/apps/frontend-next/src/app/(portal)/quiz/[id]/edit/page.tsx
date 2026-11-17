import { BackLink } from "@/components/shared/BackLink"; // [2026-10-23]: enlace «volver» uniforme (icono + texto)
import { notFound } from "next/navigation";
import { getQuiz } from "@/lib/quiz-api";
import { getCurrentUserRole } from "@/lib/auth";
import { Role } from "@/lib/constants";
import { QuizForm } from "@/components/quiz/QuizForm"; // [Formulario único]: el mismo del alta, con `initial`
import { CATEGORY_VALUES } from "@/lib/categories";
import type { LanguageSkill } from "@/types/quiz";
import { DEFAULT_LANGUAGE } from "@/lib/languages";
// [Página editar quiz]: SSR + el MISMO formulario del alta (preguntas incluidas) | [Patrón]: Container + Presentational | [Principio]: DRY

export const dynamic = "force-dynamic";

export default async function EditQuizPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  let quiz;
  try {
    quiz = await getQuiz(id);
  } catch {
    notFound();
  }

  const role = await getCurrentUserRole();
  // [Mapeo preguntas con correctAnswer]: el backend lo devuelve para manager | [Principio]: SSOT
  const questions = (quiz.questions ?? []).map((q) => {
    const withAnswer = q as typeof q & { correctAnswer?: string };
    return {
      text: q.text,
      type: q.type,
      options: q.options ?? (q.type === "multiple_choice" ? ["", "", "", ""] : undefined),
      correctAnswer: withAnswer.correctAnswer ?? "",
      difficulty: q.difficulty,
      timeLimitSeconds: q.timeLimitSeconds,
      explanation: q.explanation,
      feedback: q.feedback,
    };
  });

  return (
    <div className="w-full space-y-5 py-4">
      {/* [2026-11-13]: igual que «Editar curso» → vuelve DIRECTO al listado de Gestión (antes pasaba por el detalle, que tenía su propio «Volver a exámenes») */}
      {quiz.kind === "final" && quiz.courseId ? (
        <BackLink href={`/courses/${encodeURIComponent(quiz.courseId)}`}>Volver al curso</BackLink>
      ) : (
        <BackLink href={role === Role.ADMIN ? "/admin/users?tab=examenes" : "/teacher/quizzes"} memo="exams">Volver a exámenes</BackLink>
      )}
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="title-page">Editar examen</h1>
          <p className="mt-1 text-muted-foreground">
            Edita metadatos y preguntas. Guardar reemplaza las preguntas existentes.
          </p>
        </div>
      </header>

      <QuizForm
        initial={{
          id: quiz.id,
          title: quiz.title,
          description: quiz.description ?? "",
          language: quiz.language ?? DEFAULT_LANGUAGE,
          // [Compatibilidad]: un quiz antiguo puede traer una materia legacy → se normaliza a "general"
          category: (CATEGORY_VALUES as readonly string[]).includes(quiz.category) ? (quiz.category as LanguageSkill) : "general",
          difficulty: quiz.difficulty,
          timePerQuestionSeconds: quiz.timePerQuestionSeconds,
          isPublished: quiz.isPublished,
          questions,
        }}
      />
    </div>
  );
}

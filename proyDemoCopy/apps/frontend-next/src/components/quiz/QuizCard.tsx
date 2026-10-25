import { Clock, NotebookPen, Timer } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis)
import Link from "next/link";
import { DifficultyBadge } from "./DifficultyBadge";
import { CategoryIcon } from "./CategoryIcon";
import { categoryLabel, difficultyLabel, totalMinutes } from "@/components/portal/quiz-format";
import type { QuizListItem } from "@/types/quiz";
// [QuizCard]: tarjeta de examen estilo exam-card (demo examenes.html) | [Patron]: Presentational + Atomic (molecule) | [Principio]: SRP

export interface QuizCardProps {
  quiz: QuizListItem & { questionsCount?: number };
  // [completed]: si el estudiante ya resolvió el examen → muestra puntaje + ver feedback | [Patrón]: Conditional Render
  completed?: boolean;
  // [scorePct]: precisión obtenida (0-100) cuando completed | [Principio]: ISP
  scorePct?: number;
}

export function QuizCard({ quiz, completed = false, scorePct }: QuizCardProps) {
  const questions = quiz.questionsCount ?? 0;
  const minutes = totalMinutes(quiz.timePerQuestionSeconds, questions || 1);

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary/40">
      {/* [ec-top]: icono + título + materia + estado */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="grid place-items-center size-11 shrink-0 rounded-xl bg-gradient-soft text-xl">
            <CategoryIcon category={quiz.category} />
          </span>
          <div className="min-w-0">
            <h3 className="font-bold leading-tight truncate">{quiz.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {categoryLabel(quiz.category)} · {difficultyLabel(quiz.difficulty)}
            </p>
          </div>
        </div>
        {completed ? (
          <span className="shrink-0 rounded-full bg-tone-brand-soft px-2.5 py-0.5 text-xs font-semibold text-tone-brand">
            Completado
          </span>
        ) : (
          <DifficultyBadge difficulty={quiz.difficulty} />
        )}
      </div>

      {/* [stats row] */}
      {completed && scorePct !== undefined ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Puntaje:</span>
          <b className={scorePct >= 60 ? "text-tone-brand" : "text-tone-warning"}>
            {scorePct}/100
          </b>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span><NotebookPen aria-hidden className="inline size-4 align-[-0.125em]" /> {questions} pregunta{questions === 1 ? "" : "s"}</span>
          <span><Timer aria-hidden className="inline size-4 align-[-0.125em]" /> {minutes} min</span>
          <span><Clock aria-hidden className="inline size-4 align-[-0.125em]" /> {quiz.timePerQuestionSeconds}s por pregunta</span>
        </div>
      )}

      {/* [ec-foot]: categoría + acción */}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {categoryLabel(quiz.category)}
        </span>
        {completed ? (
          <Link
            href="/feedback"
            className="btn btn-outline btn-sm"
          >
            Ver feedback IA →
          </Link>
        ) : (
          <Link
            href={`/quiz/${quiz.id}`}
            className="btn btn-primary btn-sm"
          >
            Iniciar examen →
          </Link>
        )}
      </div>
    </article>
  );
}

import { QuizCard } from "./QuizCard";
import { QuizActions } from "./QuizActions";
import type { QuizListItem } from "@/types/quiz";
// [QuizGrid]: layout grid responsive de exam-cards con acciones opcionales TEACHER/ADMIN | [Patron]: Composite | [Principio]: SRP

export interface QuizGridProps {
  quizzes: QuizListItem[];
  // [showActions]: si true, renderiza botones gestión (publicar/eliminar/ver) | [Patrón]: Conditional Render
  showActions?: boolean;
  // [completedMap]: quizId → precisión (0-100) si el estudiante ya lo resolvió | [Principio]: ISP
  completedMap?: Record<string, number>;
}

export function QuizGrid({ quizzes, showActions = false, completedMap }: QuizGridProps) {
  if (quizzes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
        <p className="text-muted-foreground">Aún no hay exámenes publicados.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {quizzes.map((q) => {
        const scorePct = completedMap?.[q.id];
        const completed = scorePct !== undefined;
        return (
          <div key={q.id} className="flex flex-col gap-2">
            <QuizCard quiz={q} completed={completed} scorePct={scorePct} />
            {showActions && (
              <div className="rounded-xl border border-border bg-card px-4 py-2">
                <QuizActions quizId={q.id} title={q.title} isPublished={q.isPublished} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

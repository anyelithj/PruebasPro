import { QuizActions } from "./QuizActions";
import { DifficultyBadge } from "./DifficultyBadge";
import type { QuizListItem } from "@/types/quiz";
import { categoryLabel } from "@/lib/categories";

export function QuizAdminTable({ quizzes }: { quizzes: QuizListItem[] }) {
  return (
    <div className="rounded-xl border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-3 px-4 font-semibold">Título</th>
            <th className="py-3 px-4 font-semibold">Categoría</th>
            <th className="py-3 px-4 font-semibold">Dificultad</th>
            <th className="py-3 px-4 font-semibold">Preguntas</th>
            <th className="py-3 px-4 font-semibold">Tiempo/preg</th>
            <th className="py-3 px-4 font-semibold">Estado</th>
            <th className="py-3 px-4 font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {quizzes.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-8 text-center text-muted-foreground">
                No hay exámenes registrados. Usa &quot;+ Crear examen&quot; arriba.
              </td>
            </tr>
          ) : (
            quizzes.map((q) => (
              <tr key={q.id} className="border-b last:border-0 hover:bg-muted/40">
                <td className="py-2 px-4 font-medium">{q.title}</td>
                <td className="py-2 px-4 text-muted-foreground">
                  {categoryLabel(q.category)}
                </td>
                <td className="py-2 px-4">
                  <DifficultyBadge difficulty={q.difficulty} />
                </td>
                <td className="py-2 px-4 text-muted-foreground">{q.questionsCount ?? 0}</td>
                <td className="py-2 px-4 text-muted-foreground">{q.timePerQuestionSeconds}s</td>
                <td className="py-2 px-4">
                  {q.isPublished ? (
                    <span className="inline-flex items-center rounded-full bg-tone-brand-soft px-2.5 py-0.5 text-xs font-semibold text-tone-brand">
                      Publicado
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-tone-warning-soft px-2.5 py-0.5 text-xs font-semibold text-tone-warning">
                      Borrador
                    </span>
                  )}
                </td>
                <td className="py-2 px-4">
                  <QuizActions quizId={q.id} title={q.title} isPublished={q.isPublished} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

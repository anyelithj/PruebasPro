// [Not-Found para quiz inexistente]: 404 contextual | [Patrón]: Null Object
import { BackLink } from "@/components/shared/BackLink"; // [2026-10-23]: enlace «volver» uniforme (icono + texto)
export default function QuizNotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center py-4">
      <div className="text-center max-w-md space-y-3">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Quiz no encontrado</h1>
        <p className="text-sm text-muted-foreground">El quiz que buscas no existe o fue eliminado.</p>
        <BackLink href="/quiz" memo="exams">Volver a exámenes</BackLink>
      </div>
    </div>
  );
}

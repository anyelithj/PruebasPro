import type { Metadata } from "next";
import { BackLink } from "@/components/shared/BackLink"; // [2026-10-23]: «Volver a …» uniforme encima del título
import { QuizForm } from "@/components/quiz/QuizForm"; // [Formulario único]: el mismo que usa la edición
// [Página crear examen]: cabecera + formulario compartido | [Patrón]: Container (RSC) + Presentational | [Principio]: SRP + DRY

export const metadata: Metadata = {
  title: "Crear examen",
  robots: { index: false, follow: false }, // Privada: no indexar
};

export default function CreateQuizPage() {
  return (
    <div className="w-full space-y-5 py-4">
      <BackLink href="/quiz" memo="exams">Volver a exámenes</BackLink>
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Crear examen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Define idioma, competencia y nivel MCER. Las preguntas van en el idioma objetivo y las explicaciones en español. Puedes crearlas manualmente o generarlas con IA local.
        </p>
      </header>
      <QuizForm />
    </div>
  );
}

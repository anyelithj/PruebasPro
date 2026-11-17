import type { Metadata } from "next";
import { BackLink } from "@/components/shared/BackLink";
import { redirect } from "next/navigation";
import { ExamStatusCard } from "@/components/quiz/ExamStatusCard";
import { LEVEL_OPTIONS, isLanguage, languageLabel } from "@/lib/languages";
// [LevelExamPage · 2026-11-09]: /quiz/examen/nivel?language=en&level=A1 — se llega desde la tarjeta «Examen Nivel» de Exámenes (ya no hay selector aparte)

export const metadata: Metadata = { title: "Examen de nivel", robots: { index: false, follow: false } };

export default async function LevelExamPage(props: { searchParams: Promise<{ language?: string; level?: string }> }) {
  const { language, level } = await props.searchParams;
  if (!isLanguage(language) || !LEVEL_OPTIONS.some((l) => l.value === level)) redirect("/quiz?kind=nivel");
  return (
    <div className="w-full space-y-5 py-4">
      <BackLink href="/quiz?kind=nivel" memo="exams">Volver a exámenes</BackLink>
      <header>
        <h1 className="title-page">Examen de nivel · {languageLabel(language)} {level}</h1>
        <p className="mt-1 text-muted-foreground">Demuestra tu nivel sin hacer un curso. Si apruebas, recibes un certificado de nivel verificable.</p>
      </header>
      <ExamStatusCard endpoint={`/api/quiz/exams/level?language=${language}&level=${level}`} kind="level" />
    </div>
  );
}

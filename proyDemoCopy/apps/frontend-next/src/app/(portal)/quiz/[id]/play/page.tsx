import { notFound } from "next/navigation";
import { getQuiz } from "@/lib/quiz-api";
import { QuizPlayClient } from "./QuizPlayClient";
import { BackLink } from "@/components/shared/BackLink";
// [QuizPlayPage]: SSR del quiz + delega a Client Component | [Patron]: Container/Presentational | [Principio]: SRP | [Paradigma]: RSC + async

export const metadata = { robots: { index: false, follow: false } };

export default async function QuizPlayPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ desde?: string }>;
}) {
  const [{ id }, { desde }] = await Promise.all([props.params, props.searchParams]);
  let quiz;
  try {
    quiz = await getQuiz(id);
  } catch {
    notFound();
  }
  if (!quiz.questions || quiz.questions.length === 0) notFound();

  // [Volver · 2026-11-11]: final → página del examen (que a su vez vuelve al curso o a Exámenes) · nivel → su página · práctica → Exámenes
  const back =
    quiz.kind === "final" && quiz.courseId
      ? { href: `/quiz/examen/curso/${encodeURIComponent(quiz.courseId)}${desde === "curso" ? "?desde=curso" : ""}`, label: "Volver al examen" }
      : quiz.kind === "level" && quiz.cefrLevel
        ? { href: `/quiz/examen/nivel?language=${quiz.language ?? "en"}&level=${quiz.cefrLevel}`, label: "Volver al examen" }
        : null;
  return (
    <div className="w-full space-y-5 py-4">
      {back ? <BackLink href={back.href}>{back.label}</BackLink> : <BackLink href="/quiz" memo="exams">Volver a exámenes</BackLink>}
      <QuizPlayClient quiz={quiz} />
    </div>
  );
}

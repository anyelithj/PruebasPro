import { notFound } from "next/navigation";
import { getQuiz } from "@/lib/quiz-api";
import { QuizPlayClient } from "./QuizPlayClient";
// [QuizPlayPage]: SSR del quiz + delega a Client Component | [Patron]: Container/Presentational | [Principio]: SRP | [Paradigma]: RSC + async

export const metadata = { robots: { index: false, follow: false } };

export default async function QuizPlayPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  let quiz;
  try {
    quiz = await getQuiz(id);
  } catch {
    notFound();
  }
  if (!quiz.questions || quiz.questions.length === 0) notFound();

  return <QuizPlayClient quiz={quiz} />;
}

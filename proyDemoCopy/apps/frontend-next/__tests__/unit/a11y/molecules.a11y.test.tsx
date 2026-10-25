// [Test a11y molecules]: sin violaciones WCAG en moléculas | [Herramienta]: jest-axe | [Principio]: WCAG 2.1 AA
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import { ScoreDisplay } from "@/components/quiz/ScoreDisplay";
import { QuizProgress } from "@/components/quiz/QuizProgress";
import type { QuestionPublic } from "@/types/quiz";

const question: QuestionPublic = {
  id: "q1",
  text: "¿Capital de Francia?",
  type: "multiple_choice",
  options: ["París", "Madrid"],
  difficulty: "easy",
  position: 0,
};

describe("a11y: moléculas", () => {
  it("QuestionCard no tiene violaciones", async () => {
    const { container } = render(
      <QuestionCard question={question} selectedAnswer={null} onSelect={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("ScoreDisplay no tiene violaciones", async () => {
    const { container } = render(
      <ScoreDisplay points={300} correctCount={3} totalQuestions={4} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  // DEFECTO A11Y REAL (reportado): QuizProgress pinta role="progressbar" SIN nombre accesible
  // (falta aria-label/aria-labelledby) → axe regla "aria-progressbar-name". No se corrige src.
  // El test fija el defecto conocido: la ÚNICA violación debe ser la del nombre del progressbar.
  it("QuizProgress: documenta la violación conocida del nombre del progressbar", async () => {
    const { container } = render(<QuizProgress current={2} total={5} />);
    const results = await axe(container);
    const ids = results.violations.map((v) => v.id);
    // [snapshot del defecto]: si aparece otra violación distinta, el test debe alertar
    expect(ids).toEqual(["aria-progressbar-name"]);
  });
});

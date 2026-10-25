// [Test ScoreDisplay]: puntaje final + tier por accuracy | [Patrón]: Component Test | [Principio]: SRP
import { render, screen } from "@testing-library/react";
import { ScoreDisplay } from "@/components/quiz/ScoreDisplay";

describe("ScoreDisplay", () => {
  it("muestra los puntos redondeados", () => {
    render(<ScoreDisplay points={123.6} correctCount={3} totalQuestions={4} />);
    expect(screen.getByText("124")).toBeInTheDocument();
  });

  it("muestra aciertos y precisión", () => {
    render(<ScoreDisplay points={100} correctCount={3} totalQuestions={4} />);
    expect(screen.getByText("3/4")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("tier PERFECTO con 100% de acierto", () => {
    render(<ScoreDisplay points={400} correctCount={4} totalQuestions={4} />);
    expect(screen.getByText("PERFECTO")).toBeInTheDocument();
  });

  it("tier Excelente con >= 75%", () => {
    render(<ScoreDisplay points={300} correctCount={3} totalQuestions={4} />);
    expect(screen.getByText("Excelente")).toBeInTheDocument();
  });

  it("tier Bien hecho con >= 50%", () => {
    render(<ScoreDisplay points={200} correctCount={2} totalQuestions={4} />);
    expect(screen.getByText("Bien hecho")).toBeInTheDocument();
  });

  it("tier Sigue practicando por debajo del 50%", () => {
    render(<ScoreDisplay points={50} correctCount={1} totalQuestions={4} />);
    expect(screen.getByText("Sigue practicando")).toBeInTheDocument();
  });

  it("evita división por cero con 0 preguntas (0% precisión)", () => {
    render(<ScoreDisplay points={0} correctCount={0} totalQuestions={0} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});

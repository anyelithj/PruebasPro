// [Test QuestionCard]: pregunta + opciones según tipo | [Patrón]: Component Test | [Principio]: SRP
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import type { QuestionPublic } from "@/types/quiz";

const mcQuestion: QuestionPublic = {
  id: "q1",
  text: "¿Cuánto es 2+2?",
  type: "multiple_choice",
  options: ["Tres", "Cuatro"],
  difficulty: "easy",
  position: 0,
};

describe("QuestionCard", () => {
  it("muestra el enunciado de la pregunta", () => {
    render(
      <QuestionCard question={mcQuestion} selectedAnswer={null} onSelect={() => {}} />,
    );
    expect(
      screen.getByRole("heading", { name: "¿Cuánto es 2+2?" }),
    ).toBeInTheDocument();
  });

  it("renderiza una opción por cada respuesta (multiple_choice)", () => {
    render(
      <QuestionCard question={mcQuestion} selectedAnswer={null} onSelect={() => {}} />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByText("Cuatro")).toBeInTheDocument();
  });

  it("propaga onSelect al pulsar una opción", async () => {
    const onSelect = jest.fn();
    render(
      <QuestionCard question={mcQuestion} selectedAnswer={null} onSelect={onSelect} />,
    );
    await userEvent.click(screen.getByText("Cuatro"));
    expect(onSelect).toHaveBeenCalledWith("Cuatro");
  });

  it("renderiza True/False para preguntas true_false", () => {
    const tf: QuestionPublic = { ...mcQuestion, type: "true_false", options: undefined };
    render(<QuestionCard question={tf} selectedAnswer={null} onSelect={() => {}} />);
    expect(screen.getByText("True")).toBeInTheDocument();
    expect(screen.getByText("False")).toBeInTheDocument();
  });

  it("usa un input de texto para open_answer y propaga onChange", async () => {
    const onSelect = jest.fn();
    const open: QuestionPublic = { ...mcQuestion, type: "open_answer", options: undefined };
    render(<QuestionCard question={open} selectedAnswer="" onSelect={onSelect} />);
    const input = screen.getByPlaceholderText("Escribe la respuesta...");
    await userEvent.type(input, "x");
    expect(onSelect).toHaveBeenCalledWith("x");
  });

  it("deshabilita las opciones cuando isLocked", () => {
    render(
      <QuestionCard question={mcQuestion} selectedAnswer="Cuatro" isLocked onSelect={() => {}} />,
    );
    screen.getAllByRole("button").forEach((b) => expect(b).toBeDisabled());
  });

  it("marca la respuesta correcta al revelar", () => {
    render(
      <QuestionCard
        question={mcQuestion}
        selectedAnswer="Tres"
        revealCorrectAnswer="Cuatro"
        onSelect={() => {}}
      />,
    );
    // [opción correcta] => estilo success ; [seleccionada errónea] => danger
    expect(screen.getByText("Cuatro").closest("button")!.className).toContain("border-success");
    expect(screen.getByText("Tres").closest("button")!.className).toContain("border-danger");
  });
});

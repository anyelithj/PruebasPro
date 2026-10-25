// [Test AnswerOption]: botón de opción accesible | [Patrón]: Component Test | [Principio]: SRP
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnswerOption } from "@/components/quiz/AnswerOption";

describe("AnswerOption", () => {
  it("renderiza la letra (A) y el label", () => {
    render(<AnswerOption label="Cuatro" index={0} selected={false} onSelect={() => {}} />);
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("Cuatro")).toBeInTheDocument();
  });

  it("usa la letra correcta según el índice (B para index 1)", () => {
    render(<AnswerOption label="X" index={1} selected={false} onSelect={() => {}} />);
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("llama onSelect con el label al hacer click", async () => {
    const onSelect = jest.fn();
    render(<AnswerOption label="Tres" index={2} selected={false} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith("Tres");
  });

  it("refleja selección con aria-pressed", () => {
    render(<AnswerOption label="A" index={0} selected onSelect={() => {}} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("no dispara onSelect cuando está disabled", async () => {
    const onSelect = jest.fn();
    render(<AnswerOption label="A" index={0} selected={false} disabled onSelect={onSelect} />);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("aplica estilo de revelación correct/incorrect sin romper render", () => {
    const { rerender } = render(
      <AnswerOption label="A" index={0} selected={false} reveal="correct" onSelect={() => {}} />,
    );
    expect(screen.getByRole("button").className).toContain("border-success");
    rerender(
      <AnswerOption label="A" index={0} selected={false} reveal="incorrect" onSelect={() => {}} />,
    );
    expect(screen.getByRole("button").className).toContain("border-danger");
  });
});

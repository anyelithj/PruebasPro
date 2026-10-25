// [Test a11y atoms]: sin violaciones WCAG en componentes atómicos | [Herramienta]: jest-axe | [Principio]: WCAG 2.1 AA
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DifficultyBadge } from "@/components/quiz/DifficultyBadge";
import { AnswerOption } from "@/components/quiz/AnswerOption";

describe("a11y: átomos", () => {
  it("Button no tiene violaciones de accesibilidad", async () => {
    const { container } = render(<Button>Aceptar</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("Input con label asociada no tiene violaciones", async () => {
    const { container } = render(
      <div>
        <Label htmlFor="email">Correo</Label>
        <Input id="email" type="email" />
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("DifficultyBadge no tiene violaciones", async () => {
    const { container } = render(<DifficultyBadge difficulty="medium" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("AnswerOption no tiene violaciones", async () => {
    const { container } = render(
      <AnswerOption label="Opción A" index={0} selected={false} onSelect={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

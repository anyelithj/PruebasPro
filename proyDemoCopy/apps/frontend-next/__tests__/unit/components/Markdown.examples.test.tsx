import { render, screen } from "@testing-library/react";
import { Markdown } from "@/components/shared/Markdown";
// [Ejemplos · 2026-10-30]: siempre «frase (traducción)» uno por línea, sin repetidos, con la frase en el color del idioma del curso | [Herramienta]: Jest + Testing Library

const items = () => screen.getAllByRole("listitem").map((li) => li.textContent);

describe("Markdown · ejemplos", () => {
  it("separa los ejemplos escritos seguidos y quita los repetidos", () => {
    render(<Markdown lang="en" text="**Ejemplos:** I eat breakfast every morning. (Yo desayuno todos los días.) I eat breakfast every morning. (Yo desayuno todos los días.) Do you eat? (¿Comes?)" />);
    expect(screen.getByText("Ejemplos").tagName).toBe("STRONG");
    expect(items()).toEqual(["I eat breakfast every morning. (Yo desayuno todos los días.)", "Do you eat? (¿Comes?)"]);
  });

  it("líneas sueltas «frase (traducción)» sin viñetas → lista", () => {
    render(<Markdown lang="en" text={"I eat. (Yo como.)\nDogs bark. (Los perros ladran.)"} />);
    expect(items()).toHaveLength(2);
  });

  it("un párrafo normal con una aclaración entre paréntesis sigue siendo párrafo", () => {
    render(<Markdown lang="en" text="Es un verbo modal (muy frecuente)." />);
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it("colorea la frase del ejemplo aunque no tenga palabras reconocibles; la traducción no", () => {
    const { container } = render(<Markdown lang="en" text={"- Dogs bark. (Los perros ladran.)"} />);
    const foreign = container.querySelector('[lang="en"]');
    expect(foreign?.textContent).toContain("Dogs bark.");
    expect(foreign?.textContent).not.toContain("perros");
    expect(container.querySelector('[data-dict-lang="en"]')).not.toBeNull();
  });
});

// [Test WordLookupHost + PolyglotNavLink · Sprints 10.4/10.14]: el host monta <aula-word-lookup> solo si el remoto Angular registró la etiqueta y si no deja el texto plano; Recursos ofrece «Poliglota» como enlace al remoto | [Patrón]: Component Test | [Principio]: Determinista (customElements simulado)
import { render, screen } from "@testing-library/react";
import { WordLookupHost } from "@/components/language/WordLookupHost";
import { PolyglotNavLink } from "@/components/language/PolyglotNavLink";

describe("WordLookupHost", () => {
  afterEach(() => jest.restoreAllMocks());

  it("monta <aula-word-lookup> con texto e idioma cuando el remoto está registrado", async () => {
    jest.spyOn(customElements, "whenDefined").mockResolvedValue(HTMLElement as unknown as CustomElementConstructor);
    const { container } = render(<WordLookupHost text="I run every day" language="en" />);
    await screen.findByText((_, el) => el?.tagName === "AULA-WORD-LOOKUP"); // espera el cambio de estado
    const el = container.querySelector("aula-word-lookup")!;
    expect(el.getAttribute("text")).toBe("I run every day");
    expect(el.getAttribute("language")).toBe("en");
  });

  it("sin idioma o sin remoto deja el texto plano con su lang", () => {
    jest.spyOn(customElements, "whenDefined").mockReturnValue(new Promise(() => undefined));
    render(<WordLookupHost text="Bonjour" language="fr" />);
    expect(screen.getByText("Bonjour")).toHaveAttribute("lang", "fr");
    render(<WordLookupHost text="Hola" />);
    expect(screen.getByText("Hola").tagName).toBe("SPAN");
  });
});

describe("PolyglotNavLink", () => {
  it("es un enlace de navegación completa a /poliglota con su descripción", () => {
    render(<PolyglotNavLink locale="es" />);
    const link = screen.getByRole("link", { name: /Poliglota/ });
    expect(link).toHaveAttribute("href", "/poliglota");
    expect(link).toHaveAccessibleDescription(/siete idiomas/);
  });
});

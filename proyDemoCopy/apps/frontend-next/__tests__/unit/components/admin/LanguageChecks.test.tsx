// [Test LanguageChecks · 2026-11-14]: multiselect desplegable de idiomas de Poliglota (estilo Mendix) — abrir, marcar, quitar con ×,
// mínimo 2, buscador, «Seleccionar todos» y teclado | [Patrón]: Controlled Component con estado del padre simulado | [Tecnología]: Jest + RTL
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { LanguageChecks } from "@/components/admin/ActivityLangLevel";

jest.mock("next/navigation", () => ({ useRouter: () => ({ replace: jest.fn() }), useSearchParams: () => new URLSearchParams() }));

const changes: string[][] = [];
// [Host]: guarda el valor como lo haría el formulario real (estado controlado)
function Host({ initial }: { initial: string[] }) {
  const [value, setValue] = useState(initial);
  return <LanguageChecks value={value} onChange={(v) => (changes.push(v), setValue(v))} />;
}

const combobox = () => screen.getByRole("combobox");
const option = (name: RegExp) => screen.getByRole("option", { name });

beforeEach(() => (changes.length = 0));

it("muestra los elegidos como etiquetas y abre la lista con casillas al enfocar", () => {
  render(<Host initial={["en", "fr", "de"]} />);
  expect(screen.getByRole("button", { name: "Quitar Francés" })).toBeTruthy();
  expect(screen.queryByRole("listbox")).toBeNull();
  fireEvent.focus(combobox());
  expect(combobox().getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByRole("listbox").getAttribute("aria-multiselectable")).toBe("true");
  expect(option(/Inglés/).getAttribute("aria-selected")).toBe("true");
  expect(option(/Ruso/).getAttribute("aria-selected")).toBe("false");
});

it("marcar y quitar guardan en el orden canónico; con 2 no se puede quitar ninguno", () => {
  render(<Host initial={["fr", "en"]} />);
  fireEvent.focus(combobox());
  fireEvent.click(option(/Español/));
  expect(changes.at(-1)).toEqual(["en", "fr", "es"]); // Orden de LANGUAGES, no el de clic
  fireEvent.click(screen.getByRole("button", { name: "Quitar Español" }));
  expect(changes.at(-1)).toEqual(["en", "fr"]);
  expect((screen.getByRole("button", { name: "Quitar Inglés" }) as HTMLButtonElement).disabled).toBe(true); // Mínimo 2
  fireEvent.click(option(/Inglés/));
  expect(changes).toHaveLength(2); // No cambió
});

it("buscador sin tildes, «Seleccionar todos» y teclado (↓ Enter Esc)", () => {
  render(<Host initial={["en", "fr"]} />);
  fireEvent.change(combobox(), { target: { value: "portugues" } });
  expect(screen.getAllByRole("option")).toHaveLength(1);
  fireEvent.keyDown(combobox(), { key: "Enter" });
  expect(changes.at(-1)).toContain("pt");
  fireEvent.change(combobox(), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Seleccionar todos" }));
  expect(changes.at(-1)).toHaveLength(7);
  fireEvent.keyDown(combobox(), { key: "Escape" });
  expect(screen.queryByRole("listbox")).toBeNull();
});

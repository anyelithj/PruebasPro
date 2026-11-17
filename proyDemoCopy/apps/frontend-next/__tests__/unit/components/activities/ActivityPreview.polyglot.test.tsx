import { render, screen, within } from "@testing-library/react";
import { ActivityPreview } from "@/components/activities/ActivityPreview";
import { apiFetch } from "@/lib/api-client";
// [ActivityPreview · Poliglota · 2026-10-31]: la vista previa pinta el tema de la actividad en una tabla propia, sin el <iframe> de la pantalla completa | [Patrón]: Test Double | [Herramienta]: Jest + Testing Library

jest.mock("@/lib/api-client", () => ({ apiFetch: jest.fn() }));
jest.mock("@/lib/auth", () => ({ getCurrentAccessToken: jest.fn(async () => "token") }));
jest.mock("@/components/curriculum/SpeakButton", () => ({ SpeakButton: () => null }));
jest.mock("@/components/language/IpaTextHost", () => ({ IpaTextHost: () => null }));
const api = apiFetch as jest.Mock;

const props = { tab: "polyglot" as const, id: "t/1", viewHref: "/poliglota?tema=t1", title: "El clima" };
const table = {
  languages: ["en", "ru"],
  rows: [{ concept: { id: "c1", emoji: "🌧", gloss: "lluvia" }, terms: { en: { text: "rain", ipa: "ɹeɪn", needsNativeReview: false }, ru: null } }],
};

beforeEach(() => api.mockReset());

it("pinta el tema pedido en una tabla semántica, sin iframe y con el hueco visible", async () => {
  api.mockResolvedValue(table);
  const { container } = render(await ActivityPreview(props));
  expect(api.mock.calls[0][0]).toBe("/polyglot/table?topic=t%2F1"); // El id de ESTA actividad, codificado
  expect(container.querySelector("iframe")).toBeNull();
  const row = screen.getByRole("row", { name: /lluvia/ });
  expect(within(row).getByText("rain").closest("[lang]")).toHaveAttribute("lang", "en");
  expect(within(row).getByText("Sin término")).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: "Concepto" })).toBeInTheDocument();
});

it("tema vacío → aviso para editar, no la tabla de otro tema", async () => {
  api.mockResolvedValue({ languages: ["en"], rows: [] });
  render(await ActivityPreview(props));
  expect(screen.getByText(/aún no tiene palabras/)).toBeInTheDocument();
  expect(screen.queryByRole("table")).toBeNull();
});

it("backend sin datos → respaldo al reproductor del mismo tema", async () => {
  api.mockRejectedValue(new Error("down"));
  const { container } = render(await ActivityPreview(props));
  expect(container.querySelector("iframe")).toHaveAttribute("src", "/poliglota?tema=t1");
});

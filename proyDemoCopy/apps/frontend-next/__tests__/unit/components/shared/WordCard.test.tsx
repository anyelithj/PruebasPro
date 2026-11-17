import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { WordCard } from "@/components/reading/WordCard";
// [Test WordCard · 2026-10-31]: IPA antes que la traducción · el switch UK/US cambia la IPA | [Patrón]: Test Double (fetch falso) | [Herramienta]: Jest + Testing Library

jest.mock("@/components/curriculum/SpeakButton", () => ({ SpeakButton: () => null }));
const anchor = { left: 100, top: 400, bottom: 420, width: 40, height: 20, right: 140 } as DOMRect;
const json = (data: unknown) => ({ ok: true, status: 200, json: async () => data }) as Response;

beforeEach(() => {
  document.cookie = "aula-accent=us; path=/";
  global.fetch = jest.fn((url: string) =>
    url.endsWith("/ipa") ? Promise.resolve(json({ ipa: "stˈʌdi-uk", ipa_us: "stˈʌdi-us" })) : new Promise<Response>(() => undefined), // La IA no responde todavía
  ) as unknown as typeof fetch;
});

it("muestra la IPA sin esperar a la IA y el switch la cambia", async () => {
  render(<WordCard word="study" lang="en" anchor={anchor} onClose={() => undefined} />);
  expect(await screen.findByText("/stˈʌdi-us/")).toBeInTheDocument();
  expect(screen.getByText("Traduciendo…")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("switch"));
  await waitFor(() => expect(screen.getByText("/stˈʌdi-uk/")).toBeInTheDocument());
});

it("otro idioma: sin switch", async () => {
  render(<WordCard word="chat" lang="fr" anchor={anchor} onClose={() => undefined} />);
  expect(await screen.findByText("/stˈʌdi-uk/")).toBeInTheDocument();
  expect(screen.queryByRole("switch")).toBeNull();
});

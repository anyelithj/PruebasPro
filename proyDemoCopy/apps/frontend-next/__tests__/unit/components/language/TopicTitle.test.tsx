// [Test TopicTitle · 2026-10-27]: una sola petición por tema+idioma aunque React StrictMode monte dos veces, caché negativa corta tras un fallo
// y modo degradado (backend sin traducción → se pinta el tema original sin repetirlo) | [Patrón]: Component Test con fetch simulado | [Principio]: Determinista
import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { __resetTopicTitles, fetchTopicTitle, TopicTitle } from "@/components/language/TopicTitle";

jest.mock("@/components/curriculum/SpeakButton", () => ({ SpeakButton: () => null })); // El audio no es parte de esta prueba

const ok = (data: object) => ({ ok: true, json: async () => ({ statusCode: 200, data }) });

describe("TopicTitle", () => {
  beforeEach(() => __resetTopicTitles());
  afterEach(() => jest.restoreAllMocks());

  it("StrictMode + dos fichas del mismo tema → UN solo POST", async () => {
    global.fetch = jest.fn().mockResolvedValue(ok({ text: "The family", ipa: "ðə ˈfæmɪli", ipaUs: null, translationEs: "La familia", translated: true }));
    render(
      <StrictMode>
        <TopicTitle topic="La familia" language="en" />
        <TopicTitle topic="la familia " language="en" />
      </StrictMode>,
    );
    expect(await screen.findAllByText("The family")).toHaveLength(2);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("modo degradado: muestra el tema original en español, sin IPA ni «· La familia» repetido", async () => {
    global.fetch = jest.fn().mockResolvedValue(ok({ text: "La familia", ipa: null, ipaUs: null, translationEs: "La familia", translated: false }));
    const { container } = render(<TopicTitle topic="La familia" language="en" />);
    const title = await screen.findByText("La familia");
    expect(title).toHaveAttribute("lang", "es");
    expect(container.textContent).not.toContain("·");
  });

  it("fallo (503/red) → null y caché negativa: no se repite la petición dentro del plazo", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    await expect(fetchTopicTitle("La casa", "fr")).resolves.toBeNull();
    await expect(fetchTopicTitle("La casa", "fr")).resolves.toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const now = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(now + 61_000); // Vence la caché negativa → se reintenta
    await fetchTopicTitle("La casa", "fr");
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  });
});

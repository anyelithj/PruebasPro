// [Test ResourceVocabularyField + IpaTextHost · Sprint 8.4]: el editor consulta /api/vocabulary/lookup y deja USAR traducción e IPA UK/US (el docente decide); el host monta <aula-ipa-text> solo si el remoto lo registró y si no deja el texto plano | [Patrón]: Component Test con fetch simulado | [Principio]: Determinista
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResourceVocabularyField } from "@/components/language/ResourceVocabularyField";
import { IpaTextHost } from "@/components/language/IpaTextHost";

const lookup = (model = "qwen2.5:3b") => ({
  statusCode: 201,
  data: { id: "l1", result: { ipa: null, ipa_uk: "ˈeəpɔːt", ipa_us: "ˈɛɹpɔːɹt", translation: { translation: "aeropuerto", alternatives: [], model } } },
});

describe("ResourceVocabularyField", () => {
  afterEach(() => jest.restoreAllMocks());

  it("consulta el término y «Usar» rellena traducción e IPA con su variante BCP 47", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => lookup() });
    const onTranslation = jest.fn();
    const onIpa = jest.fn();
    render(<ResourceVocabularyField term="airport" language="en" onTranslation={onTranslation} onIpa={onIpa} />);
    await userEvent.click(screen.getByRole("button", { name: /Consultar/ }));
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)).toEqual({ language: "en", text: "airport" });
    await userEvent.click(await screen.findByRole("button", { name: "Usar traducción: aeropuerto" }));
    expect(onTranslation).toHaveBeenCalledWith("aeropuerto");
    await userEvent.click(screen.getByRole("button", { name: "Usar IPA estadounidense: ˈɛɹpɔːɹt" }));
    expect(onIpa).toHaveBeenCalledWith({ value: "/ˈɛɹpɔːɹt/", variant: "en-US", source: "espeak-ng (automático)" });
  });

  it("IA caída: avisa en texto y no ofrece usar la traducción (el IPA sí)", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => lookup("unavailable") });
    render(<ResourceVocabularyField term="airport" language="en" onTranslation={jest.fn()} onIpa={jest.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Consultar/ }));
    expect(await screen.findByText(/la IA local no respondió/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Usar traducción/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Usar IPA británico/ })).toBeInTheDocument();
  });

  it("error del BFF → alerta; sin término el botón está deshabilitado", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ message: "Servicio no disponible" }) });
    const { rerender } = render(<ResourceVocabularyField term="" language="en" onTranslation={jest.fn()} onIpa={jest.fn()} />);
    expect(screen.getByRole("button", { name: /Consultar/ })).toBeDisabled();
    rerender(<ResourceVocabularyField term="airport" language="en" onTranslation={jest.fn()} onIpa={jest.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /Consultar/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Servicio no disponible");
  });
});

describe("IpaTextHost", () => {
  it("con el Angular Element registrado monta <aula-ipa-text> con sus atributos", async () => {
    if (!customElements.get("aula-ipa-text")) customElements.define("aula-ipa-text", class extends HTMLElement {});
    const { container } = render(<IpaTextHost text="umbrella" language="en" />);
    await waitFor(() => expect(container.querySelector("aula-ipa-text")).not.toBeNull());
    const el = container.querySelector("aula-ipa-text")!;
    expect(el.getAttribute("text")).toBe("umbrella");
    expect(el.getAttribute("with-switch")).toBe("true");
  });

  it("sin remoto: tras la espera queda el texto plano (nunca un hueco)", async () => {
    jest.useFakeTimers();
    jest.spyOn(customElements, "whenDefined").mockReturnValue(new Promise(() => {}));
    render(<IpaTextHost text="bonjour" language="fr" />);
    act(() => {
      jest.advanceTimersByTime(4100);
    });
    expect(screen.getByText("bonjour")).toHaveAttribute("lang", "fr");
    jest.useRealTimers();
  });
});

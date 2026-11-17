// [Test ipa-phoneme-details · 2026-10-27]: el detalle de Recursos › Pronunciación cubre los 44 fonemas del inglés con 8–12 palabras, frases y errores, y la URL es estable
// [Patrón]: Unit Test de datos (Configuration Object) + funciones puras | [Principio]: Fail Fast si un docente añade un fonema sin detalle o con el símbolo mal escrito (p. ej. «g» latina en vez de «ɡ»)
import { IPA_CHART_EN } from "@/config/ipa-chart";
import { phonemeDetail, phonemeHref } from "@/config/ipa-phoneme-details";

describe("IPA phoneme details (inglés)", () => {
  const phonemes = IPA_CHART_EN.flatMap((t) => t.phonemes);

  it("cada fonema de la tabla tiene detalle completo", () => {
    expect(phonemes).toHaveLength(44);
    for (const p of phonemes) {
      const d = phonemeDetail("en", p.symbol);
      expect(d).not.toBeNull();
      expect(d!.mouthEs.length).toBeGreaterThan(20);
      expect(d!.words.length).toBeGreaterThanOrEqual(8);
      expect(d!.words.length).toBeLessThanOrEqual(12);
      expect(d!.sentences.length).toBeGreaterThanOrEqual(3);
      expect(d!.mistakesEs.length).toBeGreaterThanOrEqual(2);
      // Las transcripciones van sin barras (la UI las añade) y cada palabra trae traducción
      for (const [text, ipa, es] of d!.words) expect([text, ipa.startsWith("/"), es.length > 0]).toEqual([text, false, true]);
    }
  });

  it("sin detalle en otros idiomas → null (la página muestra la regla y las fichas del docente)", () => {
    expect(phonemeDetail("fr", "y")).toBeNull();
  });

  it("phonemeHref codifica el símbolo IPA en la query", () => {
    expect(phonemeHref("en", "ʃ")).toBe("/resources/fonema?language=en&p=%CA%83");
    expect(new URLSearchParams(phonemeHref("en", "tʃ").split("?")[1]).get("p")).toBe("tʃ");
  });
});

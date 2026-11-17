import { textSentences } from "@/components/courses/PdfReader";
import { splitByLanguage } from "@/lib/lang-detect";

// [2026-11-16]: lector del temario — Markdown → frases limpias por párrafo; y la mezcla de idiomas que bloquea «Traducir»
describe("textSentences (temario en voz alta)", () => {
  it("quita marcas de Markdown y conserva párrafos", () => {
    const md = "## Saludos\n\n**Hello**, my friend. How are you?\n\n- [Ver](https://x.y) the *farm*";
    const s = textSentences(md, "en");
    expect(s.map((x) => x.text)).toEqual(["Saludos", "Hello , my friend.", "How are you?", "Ver the farm"]);
    expect(s.map((x) => x.para)).toEqual([0, 1, 1, 2]);
  });

  it("un texto bilingüe tiene trozos en otro idioma (se bloquea la traducción completa)", () => {
    const chunks = splitByLanguage("farm – granja de la familia", "en", ["es"]);
    expect(chunks.some((c) => !c.speak && c.lang === "es")).toBe(true);
  });
});

// [2026-11-16]: se lee el contenido entre paréntesis, pero no los signos (la voz no dice «paréntesis»); los índices del resaltado no se mueven
import { muteParens } from "@/components/courses/PdfReader";
describe("muteParens", () => {
  it("cambia ( ) [ ] por espacios y conserva el texto de dentro", () => {
    const s = "I am (yo soy) happy [feliz].";
    const out = muteParens(s);
    expect(out).toHaveLength(s.length);
    expect(out.replace(/\s+/g, " ")).toBe("I am yo soy happy feliz .");
  });
});

// [2026-11-16]: palabras inglesas dentro de la explicación en español → azul y voz inglesa · «=» con palabras
import { courseVocab, markCourseWords } from "@/lib/lang-detect";
import { speakSymbols } from "@/components/courses/PdfReader";

describe("markCourseWords", () => {
  const spoken = (s: string, vocab: Set<string>) =>
    markCourseWords(s, splitByLanguage(s, "en"), "en", vocab).filter((c) => c.speak).map((c) => s.slice(c.start, c.end));

  it("marca palabras del curso ya vistas en los ejemplos y grafías inglesas", () => {
    const vocab = courseVocab(["I never eat meat.", "She is often late."], "en", ["es"]);
    expect(vocab.has("never")).toBe(true);
    expect(spoken("Usamos never y often para hablar de la frecuencia de las acciones", vocab)).toEqual(["never", "often"]);
    expect(spoken("La palabra always significa siempre en español", new Set())).toEqual(["always"]);
  });

  it("no toca el español puro", () => {
    expect(spoken("Los adverbios van antes del verbo principal", new Set())).toEqual([]);
  });
});

describe("speakSymbols", () => {
  it("«=» se dice con palabras del idioma de la voz", () => {
    expect(speakSymbols("always =", "en")).toBe("always equals");
    expect(speakSymbols("siempre = a veces", "es")).toBe("siempre es igual a veces");
  });
});

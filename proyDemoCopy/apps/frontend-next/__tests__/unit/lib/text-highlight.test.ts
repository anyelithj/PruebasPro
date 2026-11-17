import { locate, normalize } from "@/lib/text-highlight";
// [Spec text-highlight · 2026-11-16]: la frase del lector se encuentra en el texto pintado del temario aunque el Markdown cambie signos y negritas

describe("locate", () => {
  const page = normalize("Ejemplo: **I always** get up at 7. Siempre = always.").norm;

  it("encuentra la frase ignorando signos, mayúsculas y Markdown", () => {
    const at = locate(page, "I always get up at 7.", null);
    expect(at && page.slice(at.start, at.end)).toBe("ialwaysgetupat7");
  });

  it("ubica la palabra dentro de la frase ([inicio, fin) del lector)", () => {
    const at = locate(page, "I always get up at 7.", [2, 8]);
    expect(at?.word && page.slice(at.word[0], at.word[1])).toBe("always");
  });

  it("frase ausente → null", () => {
    expect(locate(page, "Nothing here", null)).toBeNull();
  });
});

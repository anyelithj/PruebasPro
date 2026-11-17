import { pdfBlocks } from "@/lib/pdf-text";
import { joinOpenParens } from "@/lib/resource-import";
import { suggestCourseTags } from "@/types/courses";
// [2026-10-30]: lector de PDF legible · entradas partidas por el PDF · etiquetas automáticas del curso

describe("pdfBlocks", () => {
  it("separa títulos y numeración, y une la frase partida por el ancho de la página", () => {
    expect(pdfBlocks("Ejercicio 1: Relaciona\n1. Sam has breakfast\nevery day.\n2. Mia eats fish.\n\nOtro párrafo")).toEqual([
      "Ejercicio 1: Relaciona",
      "1. Sam has breakfast every day.",
      "2. Mia eats fish.",
      "Otro párrafo",
    ]);
  });
});

describe("joinOpenParens", () => {
  it("une la línea que cierra un paréntesis abierto (antes «en España)» salía como palabra)", () => {
    expect(joinOpenParens(["el sauce (árbol, sobre todo", "en España)", "la casa"])).toEqual(["el sauce (árbol, sobre todo en España)", "la casa"]);
  });
});

describe("suggestCourseTags", () => {
  it("marca etiquetas según el temario, sin inventar", () => {
    expect(suggestCourseTags("El verbo to be\nPronunciación de vocales")).toEqual(["Gramática", "Pronunciación"]);
    expect(suggestCourseTags("Tema sin pistas")).toEqual([]);
  });
});

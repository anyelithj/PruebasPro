import { dictationProblems, sentencesIn } from "@/lib/reading";
// [2026-11-17]: el front cuenta frases con la misma regla que NestJS y dice qué falta

const para = (n: number) => Array.from({ length: n }, (_, i) => `Mr. Smith reads line ${i + 1}.`).join(" ");

describe("sentencesIn", () => {
  it("no corta en abreviaturas ni iniciales", () => {
    expect(sentencesIn("Mr. Smith met J. K. Rowling. ¿Ella vino? Sí.")).toBe(3);
    expect(sentencesIn(para(5))).toBe(5);
  });
});

describe("dictationProblems", () => {
  it("3 × 5 → sin problemas", () => expect(dictationProblems([para(5), para(5), para(6)])).toEqual([]));
  it("2 párrafos → explica cómo arreglarlo", () => expect(dictationProblems([para(5), para(5)])[0]).toMatch(/tiene 2 párrafo\(s\).*vuelve a generar/));
  it("párrafo de 4 → pide 1 frase más", () => expect(dictationProblems([para(5), para(4), para(5)])).toEqual([expect.stringMatching(/párrafo 2 tiene 4 frase\(s\).*escribe 1 frase/)]));
});

// [Test importación de recursos]: texto libre y tablas → contenidos por tipo | [Patrón]: Unit Test de funciones puras
import { extractedToContents, rowsToContents, splitLine, templateCsv, textToGrammar, textToRows } from "@/lib/resource-import";
import { pdfItemsToText, type PdfTextItem } from "@/lib/pdf-text";

describe("splitLine / textToRows", () => {
  it("reconoce separadores habituales y quita viñetas o numeración", () => {
    expect(splitLine("1. apple - manzana")).toEqual(["apple", "manzana"]);
    expect(splitLine("• banana = plátano")).toEqual(["banana", "plátano"]);
    expect(splitLine("cherry\tcereza\tI like cherries.")).toEqual(["cherry", "cereza", "I like cherries."]);
    expect(splitLine("What time is it? → ¿Qué hora es?")).toEqual(["What time is it?", "¿Qué hora es?"]);
    expect(splitLine("well-known")).toEqual(["well-known"]); // El guion sin espacios no separa
  });
  it("ignora líneas vacías", () => {
    expect(textToRows("apple - manzana\n\n  \npear: pera")).toEqual([["apple", "manzana"], ["pear", "pera"]]);
  });
});

describe("rowsToContents", () => {
  it("vocabulario por encabezados (orden libre), emoji inicial y sin duplicados", () => {
    const rows = [["Traducción", "Palabra", "Emoji"], ["manzana", "apple", ""], ["plátano", "🍌 banana", ""], ["manzana", "Apple", ""]];
    const r = rowsToContents("vocabulary", rows, "en");
    expect(r.contents).toEqual([
      { lemma: "apple", translationEs: "manzana", examples: [] },
      { lemma: "banana", translationEs: "plátano", emoji: "🍌", examples: [] },
    ]);
    expect(r.skipped).toBe(1);
  });
  it("frases por posición y cuenta las que no tienen traducción", () => {
    const r = rowsToContents("example", [["What time is it?", "¿Qué hora es?"], ["See you!"]], "en");
    expect(r.contents).toEqual([{ text: "What time is it?", translationEs: "¿Qué hora es?" }, { text: "See you!", translationEs: "" }]);
    expect(r.incomplete).toBe(1);
  });
  it("pronunciación con la variante IPA del idioma", () => {
    expect(rowsToContents("pronunciation", [["eau", "/o/"]], "fr").contents[0]).toEqual({ text: "eau", ipa: { value: "/o/", variant: "fr-FR" } });
  });
  it("omite líneas sueltas largas (introducciones de páginas) en vocabulario", () => {
    const r = rowsToContents("vocabulary", [["This is a list of English color names."], ["red", "rojo"], ["blue"]], "en");
    expect(r.contents.map((c) => c.lemma)).toEqual(["red", "blue"]);
    expect(r.skipped).toBe(1);
  });
  it("rechaza tipos no importables", () => {
    expect(() => rowsToContents("rubric", [["x"]], "en")).toThrow(/no se puede importar/);
  });
  it("genera plantilla CSV con BOM para Excel", () => {
    expect(templateCsv("vocabulary")?.startsWith("﻿\"palabra\"")).toBe(true);
    expect(templateCsv("rubric")).toBeNull();
  });
});

// [2026-10-24]: PDF con tablas/listas, encabezados tras un título y reglas gramaticales desde documentos
describe("pdfItemsToText", () => {
  // `item` (factory): fragmento de pdf.js en (x, y) con altura 10
  const item = (str: string, x: number, y: number, width = str.length * 5): PdfTextItem => ({ str, transform: [10, 0, 0, 10, x, y], width, height: 10 });
  it("une por línea (misma y) y separa columnas lejanas con tabulador", () => {
    const text = pdfItemsToText([item("manzana", 200, 700), item("apple", 50, 700), item("pear", 50, 680), item("pera", 200, 680)]);
    expect(text).toBe("apple\tmanzana\npear\tpera");
    expect(textToRows(text)).toEqual([["apple", "manzana"], ["pear", "pera"]]);
  });
  it("pone espacio entre palabras sueltas cercanas", () => {
    expect(pdfItemsToText([item("apple", 50, 700, 25), item("-", 78, 700, 3), item("manzana", 84, 700)])).toBe("apple - manzana");
  });
});

describe("importación ampliada", () => {
  it("encuentra los encabezados aunque haya un título antes (English | Spanish)", () => {
    const r = rowsToContents("vocabulary", [["Fruits vocabulary"], ["English", "Spanish"], ["apple", "manzana"]], "en");
    expect(r.contents).toEqual([{ lemma: "apple", translationEs: "manzana", examples: [] }]);
  });
  it("columnas separadas por 3+ espacios (OCR)", () => {
    expect(splitLine("apple    manzana")).toEqual(["apple", "manzana"]);
  });
  it("regla gramatical desde un documento: título, fórmula, explicación y ejemplos", () => {
    const doc = ["Present perfect", "Se usa para experiencias y acciones pasadas con relevancia en el presente.", "Fórmula: have/has + participio", "Ejemplos:", "I have been to London. - He estado en Londres.", "She has finished her homework."].join("\n");
    expect(textToGrammar(doc, "en")).toEqual({
      title: "Present perfect",
      explanationEs: "Se usa para experiencias y acciones pasadas con relevancia en el presente.",
      structure: "have/has + participio",
      examples: [
        { text: "I have been to London.", translationEs: "He estado en Londres." },
        { text: "She has finished her homework.", translationEs: "" },
      ],
    });
  });
  it("regla gramatical desde Excel: una regla por fila y filas de continuación con más ejemplos", () => {
    const rows = [["regla", "explicacion", "formula", "ejemplo", "traduccion del ejemplo"], ["Present perfect", "Pasado con relevancia.", "have/has + participio", "I have lost my keys.", "He perdido mis llaves."], ["", "", "", "She has left.", "Ella se ha ido."]];
    const r = extractedToContents("grammar_rule", { rows, text: "" }, "en");
    expect(r.contents).toHaveLength(1);
    expect(r.contents[0]).toMatchObject({ title: "Present perfect", structure: "have/has + participio" });
    expect((r.contents[0].examples as unknown[]).length).toBe(2);
  });
  it("usa el tema como título si el documento no trae uno", () => {
    const r = extractedToContents("grammar_rule", { rows: [], text: "Se usa para hablar de hábitos y rutinas que se repiten cada semana." }, "en", "Presente simple");
    expect(r.contents[0]).toMatchObject({ title: "Presente simple" });
  });
});

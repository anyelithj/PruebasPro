// [Test importación de recursos]: texto libre y tablas → contenidos por tipo | [Patrón]: Unit Test de funciones puras
import { rowsToContents, splitLine, templateCsv, textToRows } from "@/lib/resource-import";

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

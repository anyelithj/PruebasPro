// [Test Lectura · 2026-10-25]: funciones puras de lib/reading (texto importado → párrafos, frases → párrafos) y la estrategia «Lectura» de Crear actividad (importar, IA, validar y guardar con un ApiPort falso)
// [Patrón]: Unit Test de funciones puras + Test Double (Fake del puerto de salida) | [Principio]: DIP → sin red ni tokens
import { ACTIVITY_KINDS, ACTIVITY_ROUTES, emptyDraft, isCreatableKind, validateDraft, type ApiPort } from "@/lib/activity-kinds";
import { isReadingGenre, paragraphsFromSentences, READING_GENRE_LABEL, READING_GENRE_OPTIONS, textToParagraphs } from "@/lib/reading";

const ctx = { language: "en", level: "A2" };
const reading = ACTIVITY_KINDS.reading;

describe("lib/reading", () => {
  it("líneas en blanco separan párrafos y se unen los renglones", () => {
    expect(textToParagraphs("The fox\nran away.\n\nThe end.")).toEqual(["The fox ran away.", "The end."]);
  });
  it("sin líneas en blanco (PDF/OCR) une renglones hasta un final de frase corto", () => {
    const pdf = "Once upon a time there was a small fox who lived in the old\nforest near the river.\nEvery day it looked for food in the big green valley and it\nwas happy.";
    expect(textToParagraphs(pdf)).toEqual(["Once upon a time there was a small fox who lived in the old forest near the river.", "Every day it looked for food in the big green valley and it was happy."]);
  });
  it("en verso conserva los saltos de línea", () => {
    expect(textToParagraphs("Roses are red\nViolets are blue\n\nSugar is sweet", true)).toEqual(["Roses are red\nViolets are blue", "Sugar is sweet"]);
  });
  it("frases → párrafos (prosa con espacio, verso con salto)", () => {
    const s = [{ paragraph: 0, text: "A." }, { paragraph: 0, text: "B." }, { paragraph: 1, text: "C." }];
    expect(paragraphsFromSentences(s)).toEqual(["A. B.", "C."]);
    expect(paragraphsFromSentences(s, true)).toEqual(["A.\nB.", "C."]);
  });
  it("géneros con etiqueta y type guard", () => {
    expect(READING_GENRE_OPTIONS).toHaveLength(Object.keys(READING_GENRE_LABEL).length);
    expect(isReadingGenre("fable")).toBe(true);
    expect(isReadingGenre("novel")).toBe(false);
  });
});

describe("estrategia «Lectura»", () => {
  it("es un tipo creable con rutas Ver (Angular) y Editar (Gestión)", () => {
    expect(isCreatableKind("reading")).toBe(true);
    expect(ACTIVITY_ROUTES.reading.view("x1")).toBe("/lectura/x1");
    expect(ACTIVITY_ROUTES.reading.edit("x1")).toBe("/admin/activities/lectura/x1");
  });
  it("lo importado se separa en párrafos y la fuente queda como referencia", () => {
    const part = reading.fromExtracted({ rows: [], text: "Uno.\n\nDos." }, ctx, { label: "cuento.pdf" });
    expect(part.entries).toEqual([{ text: "Uno." }, { text: "Dos." }]);
    expect(part.title).toBe("cuento");
    expect(part.meta?.sourceRef).toBe("cuento.pdf");
  });
  it("la IA envía género, nivel y longitud (según el nivel) y devuelve párrafos para revisar", async () => {
    const post = jest.fn(async () => ({ title: "The Fox", summary: "Un zorro.", paragraphs: ["P1.", "P2."] }));
    const res = await reading.ai.run({ topic: "A fox", count: 1, meta: { genre: "fable", length: "350" } }, ctx, { post } as unknown as ApiPort);
    expect(post).toHaveBeenCalledWith("/reading/texts/draft", expect.objectContaining({ genre: "fable", level: "A2", words: 180, topic: "A fox" }));
    expect(res).toMatchObject({ kind: "draft", draft: { title: "The Fox", entries: [{ text: "P1." }, { text: "P2." }], meta: { summary: "Un zorro." } } });
  });
  it("valida texto y género; guarda con un POST y avisa de frases pendientes", async () => {
    const empty = { ...emptyDraft("reading"), title: "Fox" };
    expect(validateDraft("reading", empty, ctx).join(" ")).toMatch(/al menos un párrafo/);
    const draft = { ...empty, entries: [{ text: "The  fox\nruns." }] };
    expect(validateDraft("reading", draft, ctx)).toEqual([]);
    const post = jest.fn(async () => ({ id: "r1", pending: 2 }));
    const res = await reading.persist(draft, ctx, { post } as unknown as ApiPort);
    expect(post).toHaveBeenCalledWith("/reading/texts", expect.objectContaining({ title: "Fox", genre: "tale", paragraphs: ["The fox runs."] }));
    expect(res.id).toBe("r1");
    expect(res.warnings[0]).toMatch(/2 frase/);
  });
});

// [Test syllabus · 2026-10-25]: ida y vuelta del temario (subtemas «## …») e importación como subtemas
import { appendBlock, joinSubtopics, parseSyllabus, removeBlock, serializeSyllabus, splitSubtopics, toSubtopicBlock, toTopics } from "@/lib/syllabus";

it("parsea y serializa subtemas sin perder contenido", () => {
  const md = "## El verbo «to be»\n\n**Uso**\n\n- I am\n\n## Presente simple\n\nI work.";
  const topics = parseSyllabus(md);
  expect(topics.map((t) => t.title)).toEqual(["El verbo «to be»", "Presente simple"]);
  expect(serializeSyllabus(topics)).toBe(md);
});

it("el contenido antiguo sin encabezados queda como «Introducción»", () => {
  expect(parseSyllabus("Texto suelto\n\n## Tema")).toEqual([{ title: "Introducción", body: "Texto suelto" }, { title: "Tema", body: "" }]);
});

it("importar: divide por encabezados o crea un subtema con el título del archivo", () => {
  expect(toTopics("# A\nuno\n# B\ndos", "x").map((t) => t.title)).toEqual(["A", "B"]);
  expect(toTopics("solo texto", "apuntes.pdf")).toEqual([{ title: "apuntes.pdf", body: "solo texto" }]);
});

// [2026-10-27]: subcontenidos («### …») dentro de un subtema + jerarquía al importar

it("subcontenidos: ida y vuelta exacta (también con textos a medio escribir)", () => {
  for (const [intro, subs] of [
    ["Intro", [{ title: "Uso", body: "- I am" }, { title: "Ejemplos", body: "" }]],
    ["", [{ title: "Solo apartado", body: "texto\n" }]],
    ["Sin apartados\n\n", []],
    ["a", [{ title: "", body: "b\n\n" }, { title: " c", body: "d" }]],
  ] as const) {
    const body = joinSubtopics(intro, [...subs]);
    expect(splitSubtopics(body)).toEqual({ intro, subs });
  }
});

it("subcontenidos: el backend sigue viendo solo los «##» como subtemas", () => {
  const md = serializeSyllabus([{ title: "Tema", body: joinSubtopics("Intro", [{ title: "Apartado", body: "x" }]) }]);
  expect(parseSyllabus(md).map((t) => t.title)).toEqual(["Tema"]);
  expect(md).toContain("### Apartado");
});

it("importar: «#» = subtema y «##» = subcontenido", () => {
  const topics = toTopics("# Unidad 1\nintro\n## Saludos\nhola\n### Detalle\nx\n# Unidad 2\ny", "doc");
  expect(topics.map((t) => t.title)).toEqual(["Unidad 1", "Unidad 2"]);
  expect(splitSubtopics(topics[0]!.body).subs.map((s) => s.title)).toEqual(["Saludos"]);
  expect(topics[0]!.body).toContain("**Detalle**");
});

// [2026-10-28]: contenido importado DENTRO de un subtema → subcontenido «###» (nunca «##», que partiría el subtema) y «Quitar» lo deshace
it("importa un archivo como subcontenido del subtema y se puede quitar", () => {
  const block = toSubtopicBlock("# Apuntes\n\nintro\n\n## Afirmativa\n\nI am", "doc");
  expect(block).not.toMatch(/^## /m);
  expect(block.startsWith("### Apuntes")).toBe(true);
  expect(block).toContain("**Afirmativa**");
  expect(toSubtopicBlock("solo texto", "notas.pdf")).toBe("### notas.pdf\nsolo texto");
  const body = appendBlock("Definición.", block);
  expect(parseSyllabus(serializeSyllabus([{ title: "To be", body }]))).toHaveLength(1);
  expect(splitSubtopics(body).subs.map((s) => s.title)).toEqual(["Apuntes"]);
  expect(removeBlock(body, block)).toBe("Definición.");
  expect(removeBlock(appendBlock("", block), block)).toBe("");
});

// [2026-11-03 · Tema → Subtemas]: lo importado o generado con IA dentro de un SUBTEMA nunca parte el tema ni el subtema al guardar
import { toSubtopicBody } from "@/lib/syllabus";
describe("toSubtopicBody", () => {
  it("encabezados → #### y **negrita**; ida y vuelta conserva tema y subtema", () => {
    const body = toSubtopicBody("# Was / were\nUso.\n## Afirmativa\nI was.");
    expect(body).toBe("#### Was / were\nUso.\n**Afirmativa**\nI was.");
    const md = serializeSyllabus([{ title: "Inglés A2 · Elemental", body: joinSubtopics("Intro", [{ title: "Pasado simple: was / were", body }]) }]);
    const [tema] = parseSyllabus(md);
    expect(parseSyllabus(md)).toHaveLength(1);
    expect(splitSubtopics(tema!.body).subs).toEqual([{ title: "Pasado simple: was / were", body }]);
  });
});

// [2026-11-05]: importar por URL → explicación inicial a «Presentación» y subtemas 1.1, 1.2 sin numeración duplicada
it("splitPresentation: intro a la presentación y subtemas sin numeración", async () => {
  const { splitPresentation } = await import("@/lib/syllabus");
  const r = splitPresentation(toTopics("# Inglés B1\nCurso para…\n## 1.1 Saludos\nhola\n## 1.2 Despedidas\nadiós", "doc"));
  expect(r.presentation).toBe("Curso para…");
  // [2026-11-05]: el título del documento no es un tema → cada apartado es un Tema (como con IA)
  expect(r.topics).toEqual([{ title: "Saludos", body: "hola" }, { title: "Despedidas", body: "adiós" }]);
  const plain = splitPresentation(toTopics("Intro suelta\n## 1. Tema A\nx", "doc"));
  expect(plain).toEqual({ presentation: "Intro suelta", topics: [{ title: "Tema A", body: "x" }] });
});

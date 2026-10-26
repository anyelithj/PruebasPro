// [Test syllabus · 2026-10-25]: ida y vuelta del temario (subtemas «## …») e importación como subtemas
import { parseSyllabus, serializeSyllabus, toTopics } from "@/lib/syllabus";

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

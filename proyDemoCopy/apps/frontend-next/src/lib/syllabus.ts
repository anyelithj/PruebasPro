// [syllabus · 2026-10-25]: el TEMARIO de un curso = lista de subtemas («## Título» + explicación en Markdown) guardada en `course.content`
// SSOT con NestJS (course-materials.use-case → topicsOf: mismos encabezados «## …») | [Paradigma]: Funcional (puro, testeable)

export interface SyllabusTopic {
  title: string;
  body: string;
}

// [parseSyllabus]: Markdown → subtemas | el texto antes del primer «## » (contenido antiguo) queda como un subtema «Introducción»
export function parseSyllabus(md: string | null | undefined): SyllabusTopic[] {
  const text = (md ?? "").replace(/\r\n?/g, "\n").trim();
  if (!text) return [];
  const parts = text.split(/^##\s+/m);
  const head = parts.shift()!.trim();
  const topics = parts.map((p) => {
    const [first, ...rest] = p.split("\n");
    return { title: first!.trim(), body: rest.join("\n").trim() };
  });
  return head ? [{ title: "Introducción", body: head }, ...topics] : topics;
}

// [serializeSyllabus]: subtemas → Markdown (sin títulos vacíos) | inversa de parseSyllabus
export const serializeSyllabus = (topics: SyllabusTopic[]): string =>
  topics
    .filter((t) => t.title.trim())
    .map((t) => `## ${t.title.trim().replace(/\n/g, " ")}${t.body.trim() ? `\n\n${t.body.trim()}` : ""}`)
    .join("\n\n");

// [toTopics]: texto importado (PDF, Word, imagen, URL) → uno o varios subtemas | con «#»/«##» se divide por encabezados; si no, un subtema con el título del archivo
export function toTopics(markdown: string, fallbackTitle: string): SyllabusTopic[] {
  const md = markdown.replace(/^#{1,3}\s+/gm, "## ");
  const parsed = parseSyllabus(md);
  if (parsed.length > 1 || (parsed[0] && parsed[0].title !== "Introducción")) return parsed;
  return [{ title: fallbackTitle.trim() || "Nuevo subtema", body: markdown.trim() }];
}

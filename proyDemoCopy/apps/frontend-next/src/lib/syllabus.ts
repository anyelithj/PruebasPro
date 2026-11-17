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

// [toTopics]: texto importado (PDF, Word, imagen, URL) → uno o varios subtemas | con encabezados se divide; si no, un subtema con el título del archivo
// [2026-10-27]: respeta la JERARQUÍA del documento → el nivel de encabezado más alto = subtema («##»), el siguiente = subcontenido («###»), los más profundos = **negrita**
// (antes todos los «#», «##» y «###» se aplanaban a subtemas y se perdían los apartados) | `Math.min(...arr)` (ES2015 spread)
export function toTopics(markdown: string, fallbackTitle: string): SyllabusTopic[] {
  const depths = [...markdown.matchAll(/^(#{1,6})[ \t]+\S/gm)].map((m) => m[1]!.length); // `matchAll` (ES2020): todos los encabezados
  const top = depths.length ? Math.min(...depths) : 1;
  const md = markdown.replace(/^(#{1,6})[ \t]+(.*)$/gm, (_all, hashes: string, text: string) => {
    const d = hashes.length - top; // 0 = subtema · 1 = subcontenido · 2+ = negrita
    return d <= 0 ? `## ${text}` : d === 1 ? `### ${text}` : `**${text.trim()}**`;
  });
  const parsed = parseSyllabus(md);
  if (parsed.length > 1 || (parsed[0] && parsed[0].title !== "Introducción")) return parsed;
  return [{ title: fallbackTitle.trim() || "Nuevo subtema", body: markdown.trim() }];
}

// ───────── [Subcontenidos · 2026-10-27] ─────────
// Un subtema puede tener SUBCONTENIDOS (apartados) como «### Título» dentro de su explicación → el Markdown guardado no cambia de formato:
// el backend (topicsOf: solo «## ») y el alumno (Markdown: «###» = encabezado) siguen funcionando sin migrar nada | [Principio]: OCP + compatibilidad hacia atrás

export interface SyllabusPart {
  title: string;
  body: string;
}

// `(?!#)` (RegExp lookahead): «###» exacto (no «####») | `[ \t]?`: un espacio opcional tras las almohadillas | flag `m`: ^/$ por línea
const SUB_HEADING = /^###(?!#)[ \t]?(.*)$/gm;
const SEP = "\n\n"; // Separador entre bloques (párrafo en Markdown)
const stripSep = (s: string) => (s.endsWith(SEP) ? s.slice(0, -SEP.length) : s); // Quita SOLO el separador → lo que el usuario escribe no se recorta mientras teclea

// [splitSubtopics]: explicación del subtema → { intro, subs } | inversa EXACTA de joinSubtopics (ida y vuelta sin perder espacios) | [Paradigma]: Funcional (puro)
export function splitSubtopics(body: string): { intro: string; subs: SyllabusPart[] } {
  const marks = [...body.matchAll(SUB_HEADING)];
  if (!marks.length) return { intro: body, subs: [] };
  const intro = stripSep(body.slice(0, marks[0]!.index));
  const subs = marks.map((m, k) => {
    const next = marks[k + 1];
    const chunk = body.slice(m.index! + m[0].length, next ? next.index : body.length).replace(/^\n/, ""); // Salto tras el encabezado
    return { title: m[1] ?? "", body: next ? stripSep(chunk) : chunk };
  });
  return { intro, subs };
}

// [joinSubtopics]: { intro, subs } → explicación Markdown con «### Subcontenido» | sin intro, empieza directamente por el primer apartado
export const joinSubtopics = (intro: string, subs: SyllabusPart[]): string =>
  [...(intro || !subs.length ? [intro] : []), ...subs.map((x) => `### ${x.title.replace(/\n/g, " ")}\n${x.body}`)].join(SEP);

// [toSubtopicBlock · 2026-10-28]: Markdown importado (archivo, URL, IA) → bloque para DENTRO de un subtema: el encabezado más alto pasa a «### » (subcontenido)
// y los más profundos a **negrita** → nunca aparece un «## » que partiría el subtema en dos al guardar | sin encabezados → «### título» + texto
// [Patrón]: Adapter (documento → subcontenido) | [Principio]: DRY (misma regla de niveles que toTopics) + SSOT del formato | [Paradigma]: Funcional (pura)
export function toSubtopicBlock(markdown: string, fallbackTitle: string): string {
  const md = markdown.trim();
  const depths = [...md.matchAll(/^(#{1,6})[ \t]+\S/gm)].map((m) => m[1]!.length);
  if (!depths.length) return `### ${fallbackTitle.trim() || "Material importado"}\n${md}`;
  const top = Math.min(...depths);
  const demoted = md.replace(/^(#{1,6})[ \t]+(.*)$/gm, (_all, hashes: string, text: string) => (hashes.length === top ? `### ${text}` : `**${text.trim()}**`));
  // Texto antes del primer encabezado → se le da título para que no se mezcle con la explicación general del subtema
  return /^###/.test(demoted) ? demoted : `### ${fallbackTitle.trim() || "Material importado"}\n${demoted}`;
}

// [appendBlock · 2026-10-28]: añade un bloque al final de la explicación (separado por párrafo) | inversa: removeBlock | [Paradigma]: Funcional (pura)
export const appendBlock = (body: string, block: string): string => (body.trim() ? `${body.trimEnd()}${SEP}${block}` : block);
export const removeBlock = (body: string, block: string): string => body.replace(`${SEP}${block}`, "").replace(block, "").trim();

// [toSubtopicBody · 2026-11-03]: Markdown importado o de la IA → contenido de un SUBTEMA («### …») con la MISMA estructura que el escrito a mano:
// el encabezado más alto pasa a «#### » y los más profundos a **negrita** → nunca aparece «##»/«###» que partiría el tema o el subtema al guardar | [Paradigma]: Funcional (pura)
export function toSubtopicBody(markdown: string): string {
  const md = markdown.trim();
  const depths = [...md.matchAll(/^(#{1,6})[ \t]+\S/gm)].map((m) => m[1]!.length);
  if (!depths.length) return md;
  const top = Math.min(...depths);
  return md.replace(/^(#{1,6})[ \t]+(.*)$/gm, (_all, hashes: string, text: string) => (hashes.length === top ? `#### ${text}` : `**${text.trim()}**`));
}

// [splitPresentation · 2026-11-05]: temario IMPORTADO (archivo/URL) → misma forma que el generado por IA o a mano:
// el texto ANTES del primer subtema (la «Introducción» suelta o la explicación del primer tema) pasa a la PRESENTACIÓN del curso,
// y la numeración del documento («1.1 …», «2. …») se quita de los títulos → el editor ya numera Tema N y Subtema N.M | [Paradigma]: Funcional (pura)
const NUMBERING = /^\s*\d+(?:\.\d+)*[.)]?\s+/;
const unnumber = (title: string) => title.replace(NUMBERING, "").trim() || title.trim();
export function splitPresentation(topics: SyllabusTopic[]): { presentation: string; topics: SyllabusTopic[] } {
  let presentation = "";
  let rest = topics;
  if (rest[0]?.title === "Introducción") {
    presentation = rest[0].body.trim();
    rest = rest.slice(1);
  }
  const clean = rest.map((t, i) => {
    const { intro, subs } = splitSubtopics(t.body);
    const subsClean = subs.map((s) => ({ ...s, title: unnumber(s.title) }));
    // Primer tema con apartados: su explicación suelta es la presentación del documento (si aún no hay una)
    if (i === 0 && !presentation && subs.length && intro.trim()) {
      presentation = intro.trim();
      return { title: unnumber(t.title), body: joinSubtopics("", subsClean) };
    }
    return { title: unnumber(t.title), body: subs.length ? joinSubtopics(intro, subsClean) : t.body };
  });
  // [Fix 2026-11-05 · un solo tema = título del documento]: «# Inglés B1 · Intermedio» + apartados → cada apartado es un TEMA (Tema 1, Tema 2…), como con IA
  const only = clean.length === 1 ? splitSubtopics(clean[0]!.body) : null;
  if (only && only.subs.length > 1) {
    if (!presentation) presentation = only.intro.trim();
    return { presentation, topics: only.subs.map((x) => ({ title: x.title.trim(), body: x.body.trim() })) };
  }
  return { presentation, topics: clean };
}

import type { SocialLinks } from "@/types/profile"; // [2026-10-28]: redes sociales del autor (SSOT en types/profile)
// [Tipos compartidos Courses]: SSOT entre frontend y backend NestJS | [Patrón]: Type Module | [Principio]: SSOT | [Paradigma]: TS estructural

// [Nivel MCER]: categoría fina del curso, alineada con CourseCategory del backend
export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

// [Categoría]: nivel MCER vigente; `string & {}` (TS) admite valores legacy sin perder el autocompletado de los niveles
export type CourseCategory = CefrLevel | (string & {});

// [Grupo = idioma del curso]: alineado con ACTIVE_COURSE_GROUPS del backend
export type LanguageGroup = "EN" | "FR" | "DE" | "ES" | "PT" | "ZH" | "RU";

// [Grupo]: idioma vigente; admite grupos legacy que pudieran llegar de filas antiguas
export type CourseGroup = LanguageGroup | (string & {});

// [Autor del curso · 2026-10-28]: resumen PÚBLICO del docente (sin email ni teléfono) | espejo de CourseAuthorDto (NestJS) | [Principio]: Least Privilege
export interface CourseAuthor {
  id: string;
  name: string;
  bio: string | null;
  social: SocialLinks; // null por red = no configurada
}

// [Respuesta GET /courses/:id]
export interface CourseResponse {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  description: string | null;
  content: string | null; // [2026-10-24]: TEMARIO del curso en Markdown («## Subtema» + explicación) | solo en el DETALLE; en listados llega null
  objectives?: string | null; // [2026-10-25]: ficha del curso (separada del temario)
  audience?: string | null;
  category: CourseCategory;
  categoryLabel: string;
  group: CourseGroup;
  instructor: string;
  instructorTitle: string | null;
  color: string;
  icon: string;
  tags: string[];
  eje: number;
  lab: string | null;
  price: number;
  originalPrice: number | null;
  currency: string;
  isFree: boolean;
  tokens: number;
  discountPercent: number;
  durationHours: number;
  level: string;
  rating: number;
  studentsCount: number;
  modality: string;
  isProBono: boolean;
  isPublished: boolean;
  createdBy?: string | null; // [2026-10-27]: dueño (docente/admin que lo creó) | `?`: backend anterior sin el campo
  author?: CourseAuthor | null; // [2026-10-28]: perfil público del dueño (bio + redes) para «Autoría del contenido» | solo en el DETALLE · null sin dueño
  // [Estado por usuario]
  progress: number;
  // [Caso F · 2026-11-13]: ⭐ favorito privado + reacción excluyente 👍/❤️ + conteos públicos (antes likeOn/loveOn sin conteos) → ver CourseEngagement
  isFavorite: boolean;
  reaction: ReactionType | null;
  likesCount: number;
  lovesCount: number;
  hasAccess: boolean; // [Acceso al material]: comprado (pago) o inscrito (gratis) — el backend lo exige al servir cada archivo
  completedMaterialIds: string[]; // [Línea de tiempo]: materiales ya marcados como completados
  completedTopics?: string[]; // [2026-10-25]: subtemas del temario estudiados
  createdAt: string;
  updatedAt: string;
}

// [COURSE_CONTENT_MAX_CHARS · 2026-10-24]: tope de lo que DEVUELVE «Importar contenido del curso» (/api/courses/import), no de la columna (text ilimitado)
// [2026-10-25]: 400 000 caracteres (≤ ~1,2 MB UTF-8 en el peor caso) < 2 MB de `useBodyParser('json')` (NestJS · main.ts) y de `serverActions.bodySizeLimit` (next.config.ts) | [Principio]: límites alineados en una sola cifra
export const COURSE_CONTENT_MAX_CHARS = 400_000;

export interface PaginatedCoursesResponse {
  data: CourseResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface CourseFilterInput {
  isPublished?: "true" | "false"; // [2026-10-30]: solo Gestión → filtro «Estado»
  group?: CourseGroup;
  category?: CourseCategory;
  eje?: number;
  search?: string;
  isProBono?: boolean;
  page?: number;
  limit?: number;
}

// [Modalidades del curso]: valores canónicos guardados en BD (máx. 20 caracteres en el backend) | `as const` (TS): tupla de literales | [Principio]: SSOT
export const COURSE_MODALITIES = ["Online", "Presencial", "Híbrido", "Autoaprendizaje"] as const;
export type CourseModality = (typeof COURSE_MODALITIES)[number];

// [Etiquetas del catálogo]: lista cerrada para que las etiquetas sean consistentes y filtrables (antes texto libre separado por comas)
export const COURSE_TAGS = [
  "Conversación",
  "Gramática",
  "Vocabulario",
  "Pronunciación",
  "Comprensión lectora",
  "Comprensión auditiva",
  "Escritura",
  "Preparación de examen",
  "Negocios",
  "Viajes",
  "Intensivo",
  "Para niños",
] as const;
export const MAX_COURSE_TAGS = 10; // [SSOT]: el máximo que anuncia el formulario

// [suggestCourseTags · 2026-10-30]: etiquetas según el temario (manual, archivo, enlace o IA) → siempre quedan marcadas al crear | [Patrón]: Table-Driven | [Paradigma]: Función pura
// `\b` + `i` (RegExp): palabra completa sin distinguir mayúsculas | ponytail: palabras clave fijas en español e inglés; una etiqueta nueva = una fila
const TAG_KEYWORDS: ReadonlyArray<[(typeof COURSE_TAGS)[number], RegExp]> = [
  ["Conversación", /\b(conversaci[oó]n|di[aá]logos?|saludos?|presentarse|hablar|speaking)\b/i],
  ["Gramática", /\b(gram[aá]tica|verbos?|presente|pasado|futuro|art[ií]culos?|pronombres?|adjetivos?|adverbios?|preposiciones?|plural|tiempos? verbal(es)?|grammar|tenses?|was|were)\b/i],
  ["Vocabulario", /\b(vocabulario|palabras?|l[eé]xico|colores|n[uú]meros|familia|comida|ropa|animales|profesiones|vocabulary|words)\b/i],
  ["Pronunciación", /\b(pronunciaci[oó]n|fon[eé]tica|ipa|acento|sonidos?|vocales|consonantes)\b/i],
  ["Comprensión lectora", /\b(lectura|leer|comprensi[oó]n lectora|textos?|reading)\b/i],
  ["Comprensión auditiva", /\b(escuchar|auditiva|audios?|listening|canciones)\b/i],
  ["Escritura", /\b(escritura|escribir|redacci[oó]n|ortograf[ií]a|writing)\b/i],
  ["Preparación de examen", /\b(ex[aá]menes|examen|delf|ielts|toefl|cambridge|goethe|certificaci[oó]n)\b/i],
  ["Negocios", /\b(negocios?|empresa|oficina|trabajo|business)\b/i],
  ["Viajes", /\b(viajes?|viajar|aeropuerto|hotel|turismo)\b/i],
  ["Para niños", /\b(ni[nñ]os|infantil)\b/i],
];
export const suggestCourseTags = (text: string): string[] => TAG_KEYWORDS.filter(([, re]) => re.test(text)).map(([tag]) => tag);

// [Laboratorios de práctica]: lista cerrada para el campo "Laboratorio" (antes texto libre poco claro) | máx. 60 caracteres en el backend | [Principio]: SSOT
export const COURSE_LABS = [
  "Lab de pronunciación",
  "Lab de conversación",
  "Lab de comprensión auditiva",
  "Lab de lectura",
  "Lab de escritura",
  "Lab de gramática",
  "Lab de vocabulario",
] as const;

// [Duración por defecto]: horas orientativas de un nivel MCER en un curso (editable)
export const DEFAULT_COURSE_HOURS = 40;

// [Caso F · 2026-11-13]: 👍 like = valoración positiva · ❤️ love = alta satisfacción — EXCLUYENTES (máximo una por usuario y curso)
export type ReactionType = "like" | "love";
// [CourseEngagement]: lo que pinta la barra ⭐ 👍 ❤️ (mismo contrato que CourseEngagementDto de NestJS) | `Pick` (TS): subconjunto tipado de CourseResponse → SSOT
export type CourseEngagement = Pick<CourseResponse, "isFavorite" | "reaction" | "likesCount" | "lovesCount">;

// [Idiomas del catálogo]: orden de los chips de filtro | [Principio]: SSOT
export const LANGUAGE_GROUPS: ReadonlyArray<LanguageGroup> = ["EN", "FR", "DE", "ES", "PT", "ZH", "RU"];

// [Etiquetas SSOT en ES]: usadas por chips y cards | [Principio]: SSOT + DRY
export const COURSE_GROUP_LABEL: Readonly<Record<LanguageGroup, string>> = Object.freeze({
  EN: "Inglés",
  FR: "Francés",
  DE: "Alemán",
  ES: "Español",
  PT: "Portugués",
  ZH: "Chino mandarín",
  RU: "Ruso",
});

// [Color marca por idioma]: gama índigo/violeta/fucsia/azul, sin verdes; alineado con el seed del backend | [Principio]: SSOT
export const COURSE_GROUP_COLOR: Readonly<Record<LanguageGroup, string>> = Object.freeze({
  EN: "#6366F1",
  FR: "#8B5CF6",
  DE: "#A855F7",
  ES: "#D946EF",
  PT: "#EC4899",
  ZH: "#F43F5E",
  RU: "#3B82F6",
});

// [Lookup tolerante]: grupo legacy → etiqueta cruda / color primario | [Principio]: Robustez
export const courseGroupLabel = (g: CourseGroup): string =>
  COURSE_GROUP_LABEL[g as LanguageGroup] ?? g;
export const courseGroupColor = (g: CourseGroup): string =>
  COURSE_GROUP_COLOR[g as LanguageGroup] ?? "#6366F1";

// ───── Material del curso (videos y PDF) ─────
// [CourseMaterial]: espejo de la entidad del backend (solo metadatos; el archivo se sirve en /api/courses/:id/materials/:mid/file)
export type CourseMaterialKind = "video" | "pdf" | "image" | "audio" | "document" | "link"; // [2026-10-23]: + audio, documentos y enlaces
export interface CourseMaterial {
  id: string;
  courseId: string;
  title: string;
  kind: CourseMaterialKind;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  url?: string | null; // [2026-10-23]: solo kind=link
  position: number;
  createdAt: string;
}

// [Tipos aceptados]: mismo listado blanco que el backend | `accept` del <input type="file"> con MIME + extensiones → el selector de Windows muestra también los PDF
export const MATERIAL_MIMES = [
  "video/mp4", "video/webm", "video/ogg", "application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif",
  // [2026-10-23]: audio y documentos de estudio (espejo de MATERIAL_MIME de NestJS)
  "audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/x-m4a", "audio/ogg", "audio/webm",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", "text/plain", "text/markdown", "text/csv",
] as const;
// [Solo extensiones]: Chrome/Edge en Windows arman el filtro del diálogo desde el registro; si no hay lector de PDF instalado, "application/pdf" no muestra los .pdf → las extensiones siempre funcionan
export const MATERIAL_ACCEPT = ".mp4,.m4v,.webm,.ogv,.pdf,.png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.m4a,.oga,.opus,.docx,.doc,.xlsx,.xls,.pptx,.txt,.md,.csv";

// [Extensión → MIME]: algunos SO entregan el PDF/video con `file.type` vacío → se deduce por la extensión (espejo del backend) | [Patrón]: Lookup Table
const EXT_MIME: Readonly<Record<string, string>> = {
  mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm", ogv: "video/ogg", ogg: "video/ogg",
  pdf: "application/pdf",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif",
  mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", oga: "audio/ogg", opus: "audio/ogg",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", doc: "application/msword",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xls: "application/vnd.ms-excel",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", txt: "text/plain", md: "text/markdown", csv: "text/csv",
};

// [Icono por tipo]: SSOT para listas, formulario y línea de tiempo | [Patrón]: Lookup Table
export const MATERIAL_ICON: Readonly<Record<CourseMaterialKind, string>> = { video: "🎞️", pdf: "📄", image: "🖼️", audio: "🎧", document: "📝", link: "🔗" };

// [materialKindOf · 2026-10-23]: MIME → tipo de material (espejo del backend) para el icono antes de subir | [Paradigma]: Funcional (pura)
export const materialKindOf = (mime: string | undefined): CourseMaterialKind =>
  !mime ? "document" : mime.startsWith("video/") ? "video" : mime.startsWith("audio/") ? "audio" : mime.startsWith("image/") ? "image" : mime === "application/pdf" ? "pdf" : "document";

// [materialMime]: MIME admitido del archivo o undefined | `includes` (ES2016) + `split/pop` (ES5) | [Paradigma]: Funcional (pura)
export const materialMime = (file: { type: string; name: string }): string | undefined =>
  (MATERIAL_MIMES as readonly string[]).includes(file.type) ? file.type : EXT_MIME[file.name.split(".").pop()?.toLowerCase() ?? ""];
export const MAX_MATERIAL_MB = 500;

// [materialFileUrl]: URL del BFF para reproducir/abrir un material | [Principio]: DRY
export const materialFileUrl = (courseId: string, materialId: string): string =>
  `/api/courses/${encodeURIComponent(courseId)}/materials/${encodeURIComponent(materialId)}/file`;

// [lessonHref]: ruta de la página de una lección (como openLesson del demo: pantalla propia) | [Principio]: DRY + SSOT
export const lessonHref = (courseId: string, materialId: string): string =>
  `/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(materialId)}`;

// [nextPendingIndex]: índice de la primera lección sin completar (-1 = curso completo) | `findIndex` (ES2015) | [Paradigma]: Funcional (pura)
export const nextPendingIndex = (items: ReadonlyArray<{ id: string }>, done: ReadonlySet<string>): number =>
  items.findIndex((x) => !done.has(x.id));

// [isLessonLocked]: desbloqueo secuencial — solo alumnos (canTrack) y solo lecciones por delante de la primera pendiente | [Principio]: Regla de negocio única (cliente y servidor)
export const isLessonLocked = (i: number, nextPending: number, canTrack: boolean): boolean =>
  canTrack && nextPending !== -1 && i > nextPending;

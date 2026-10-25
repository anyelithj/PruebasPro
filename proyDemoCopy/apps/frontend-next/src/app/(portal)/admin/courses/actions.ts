"use server"; // [Next.js]: cada export es una Server Action → se ejecuta solo en el servidor (token y backend nunca llegan al cliente)
import { revalidatePath } from "next/cache"; // [Next.js]: invalida la caché del listado para que aparezcan los cambios
import { z } from "zod"; // [Zod 4]: validación en runtime con inferencia de tipos TS
import { createCourse, deleteCourse, setCoursePublished, updateCourse } from "@/lib/courses-api"; // [Facade]: /courses (el backend exige rol ADMIN)
import { fmt, type Dictionary } from "@aula/shared-i18n";
import { getServerDictionary } from "@/lib/i18n-server";
import { slugify } from "@/lib/slug"; // [Helper]: mismo algoritmo de slug que el backend
import { COURSE_MODALITIES, COURSE_TAGS, courseGroupColor, DEFAULT_COURSE_HOURS, LANGUAGE_GROUPS, type LanguageGroup } from "@/types/courses";
import { CEFR_LEVELS } from "@/lib/constants"; // [SSOT niveles MCER]: misma lista en todo el frontend | [Principio]: DRY
// [Server Actions de cursos]: guardar (crear o editar con el MISMO formulario), publicar y eliminar | [Patrón]: Command + Validation Pipeline | [Principio]: SRP + DRY (un esquema para alta y edición) | [Paradigma]: Funcional + asíncrono

// `as [LanguageGroup, ...LanguageGroup[]]` (TS): z.enum exige tupla no vacía
const GROUPS = LANGUAGE_GROUPS as unknown as [LanguageGroup, ...LanguageGroup[]];

// [buildSchema]: esquema con mensajes en el idioma del usuario | [Patrón]: Factory | límites = los de CreateCourseDto del backend
function buildSchema(t: Dictionary) {
  const req = t.common.required;
  const max = (n: number) => fmt(t.common.max, { n }); // Closure (JS): mensaje con el límite concreto
  // `z.coerce.number()` (Zod): convierte el string del <input type="number"> a número antes de validar
  const money = z.coerce.number({ message: t.common.invalid }).min(0, t.common.invalid);
  return z
    .object({
      title: z.string().trim().min(1, req).max(200, max(200)),
      slug: z.string().trim().max(220, max(220)).regex(/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)?$/, t.common.slug), // Vacío permitido → se genera
      description: z.string().trim().min(1, req).max(4000, max(4000)), // [Una sola descripción]: de ella se deriva el resumen (shortDescription)
      group: z.enum(GROUPS, { message: t.common.invalid }),
      category: z.enum(CEFR_LEVELS, { message: t.common.invalid }),
      instructor: z.string().trim().min(1, req).max(120, max(120)),
      instructorTitle: z.string().trim().max(160, max(160)),
      tags: z.array(z.enum(COURSE_TAGS)).max(10, fmt(t.common.max, { n: 10 })), // [Lista cerrada]: solo etiquetas del catálogo
      lab: z.string().trim().max(60, max(60)),
      access: z.enum(["free", "paid"], { message: t.common.invalid }), // [Gratuito / De pago]: decide si se exige precio
      price: money,
      originalPrice: z.union([z.literal(""), money]), // "" = sin precio original
      durationHours: z.coerce.number({ message: t.common.invalid }).int(t.common.invalid).min(0, t.common.invalid),
      modality: z.enum(COURSE_MODALITIES, { message: t.common.invalid }),
      isProBono: z.boolean(),
      isPublished: z.boolean(),
    })
    // `superRefine` (Zod): regla entre campos → un curso de pago necesita precio > 0 | [Principio]: Fail Fast
    .superRefine((v, ctx) => {
      if (v.access === "paid" && v.price <= 0) ctx.addIssue({ code: "custom", path: ["price"], message: t.adminCourses.fields.pricePaidRequired });
    });
}

// `type` (TS): claves del formulario inferidas del esquema | `ReturnType` + `z.infer` (TS utility types)
type CourseFormValues = z.infer<ReturnType<typeof buildSchema>>;

// [Estado del formulario]: contrato con useActionState | `Partial<Record<…>>` (TS): errores opcionales por campo
export type CourseFormState = {
  status: "idle" | "error" | "success";
  id?: string; // Id del curso guardado → el cliente adjunta los materiales y navega
  message?: string;
  fieldErrors?: Partial<Record<keyof CourseFormValues, string>>;
};

// [summarize]: resumen ≤ 500 caracteres cortando en el último espacio (no parte palabras) | [Paradigma]: Funcional (pura)
function summarize(text: string, limit = 500): string {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : cut.length)}…`;
}

// [revalidate]: listado admin + catálogo público | [Principio]: DRY
function revalidate() {
  revalidatePath("/admin/courses");
  revalidatePath("/courses");
}

// [saveCourseAction]: con campo oculto `id` → PATCH (editar); sin él → POST (crear) | `export async function` (ES2017): React la invoca con (estadoPrevio, FormData) | [Patrón]: Strategy por presencia de id
export async function saveCourseAction(_prev: CourseFormState, formData: FormData): Promise<CourseFormState> {
  const t = await getServerDictionary();
  const text = (key: string) => String(formData.get(key) ?? ""); // Helper local: FormData → string ("" si falta)
  const id = text("id") || undefined;

  const parsed = buildSchema(t).safeParse({
    title: text("title"),
    slug: text("slug"),
    description: text("description"),
    group: text("group"),
    category: text("category"),
    instructor: text("instructor"),
    instructorTitle: text("instructorTitle"),
    tags: formData.getAll("tags").map(String), // `getAll` (Web API FormData): todas las casillas marcadas con name="tags"
    lab: text("lab"),
    access: text("access") || "free",
    price: text("price") || "0",
    originalPrice: text("originalPrice"),
    durationHours: text("durationHours") || String(DEFAULT_COURSE_HOURS),
    modality: text("modality"),
    isProBono: formData.get("isProBono") === "on", // Checkbox HTML: "on" si está marcado, ausente si no
    isPublished: formData.get("isPublished") === "on",
  });

  if (!parsed.success) {
    // `z.flattenError` (Zod 4) → { fieldErrors: { campo: string[] } } | `Object.entries/fromEntries` (ES2019): primer mensaje por campo
    const flat = z.flattenError(parsed.error).fieldErrors as Record<string, string[] | undefined>;
    const fieldErrors = Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, v?.[0]])) as CourseFormState["fieldErrors"];
    return { status: "error", id, message: t.adminCourses.fixFields, fieldErrors };
  }

  const v = parsed.data; // Datos ya validados y tipados
  const free = v.access === "free"; // Gratuito → precio 0 y sin precio original (el backend deriva isFree de price)
  const payload = {
    title: v.title,
    slug: v.slug || slugify(v.title), // Slug vacío → derivado del título
    shortDescription: summarize(v.description), // Resumen para la tarjeta (máx. 500 del backend)
    description: v.description,
    group: v.group,
    category: v.category,
    instructor: v.instructor,
    instructorTitle: v.instructorTitle || null,
    color: courseGroupColor(v.group), // [SSOT]: color del idioma (gama morada/índigo de la marca)
    icon: v.group, // Las cards muestran el código del idioma como icono (EN, FR…)
    tags: v.tags,
    lab: v.lab || null,
    price: free ? 0 : v.price,
    originalPrice: free || v.originalPrice === "" ? null : v.originalPrice,
    durationHours: v.durationHours,
    level: v.category, // Nivel legible = nivel MCER
    modality: v.modality,
    isProBono: v.isProBono,
    isPublished: v.isPublished,
  };

  let savedId: string;
  try {
    savedId = id ? (await updateCourse(id, payload)).id : (await createCourse(payload)).id;
  } catch (err) {
    // `instanceof` (JS): estrecha unknown → Error | el mensaje del backend (p. ej. slug duplicado) se muestra tal cual
    return { status: "error", id, message: err instanceof Error ? err.message : t.adminCourses.saveError };
  }

  revalidate();
  // [Sin redirect]: los videos/PDF se suben desde el navegador (streaming con progreso; una Server Action tiene límite de ~1 MB de cuerpo)
  return { status: "success", id: savedId };
}

// [Resultado de acciones de fila]: ok o mensaje de error mostrable
export type RowActionResult = { ok: true } | { ok: false; message: string };

// [runRow]: plantilla común de las acciones de fila (try/catch + revalidación) | [Patrón]: Template Method funcional | [Principio]: DRY
async function runRow(action: () => Promise<unknown>): Promise<RowActionResult> {
  try {
    await action();
    revalidate();
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

// [setCoursePublishedAction]: publicar / despublicar (baja blanda)
export async function setCoursePublishedAction(id: string, isPublished: boolean): Promise<RowActionResult> {
  return runRow(() => setCoursePublished(id, isPublished));
}

// [deleteCourseAction]: baja definitiva (el backend borra también sus materiales)
export async function deleteCourseAction(id: string): Promise<RowActionResult> {
  return runRow(() => deleteCourse(id));
}

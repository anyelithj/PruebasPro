"use server"; // [Next.js]: Server Action → el token viaja solo en el servidor
import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api-client";
import { getCurrentAccessToken } from "@/lib/auth";
import { ACTIVITY_TAB_KEYS, GAMES, removeActivity, setActivityPublished, type ActivityTab } from "@/lib/activities-api";
import { ACTIVITY_KINDS, deckItemsOf, isCreatableKind, validateDraft, type ActivityDraft, type AiInput, type AiResult, type ApiPort, type CreatableKind, type EditApiPort, type KindContext } from "@/lib/activity-kinds"; // [2026-10-24]: estrategias de «Crear actividad»
import { isLanguage, LEVEL_OPTIONS } from "@/lib/languages";
// [Server Actions de Actividades · 2026-10-23]: eliminar una actividad de cualquier sección desde Gestión | [Patrón]: Command | [Principio]: SRP + validación en el servidor (la pestaña llega del cliente)

type RowResult = { ok: true; notice?: string } | { ok: false; message: string }; // Mismo contrato que RowActions

export async function deleteActivityAction(tab: ActivityTab, id: string): Promise<RowResult> {
  if (!ACTIVITY_TAB_KEYS.includes(tab)) return { ok: false, message: "Sección no válida." }; // [Fail Fast]: nunca se construye una ruta con un valor arbitrario
  try {
    await removeActivity(tab, id);
    revalidatePath("/admin/activities");
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

// [setActivityPublishedAction · 2026-10-23]: Publicar / Despublicar desde la tabla (mismo botón que Recursos) | revalida Gestión y la página del estudiante
export async function setActivityPublishedAction(tab: ActivityTab, id: string, publish: boolean): Promise<RowResult> {
  if (!ACTIVITY_TAB_KEYS.includes(tab)) return { ok: false, message: "Sección no válida." };
  try {
    const notice = await setActivityPublished(tab, id, publish);
    revalidatePath("/admin/activities");
    revalidatePath("/actividades");
    return notice ? { ok: true, notice } : { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

// [updateGameAction · 2026-10-24]: guarda título y descripción propios de un juego (formulario de /admin/activities/juegos/[type]) | `FormData` (Web API) del <form action>
// Vacío = vuelve al nombre/descr. por defecto | [Patrón]: Command
// [2026-10-28]: devuelve RowResult (antes `redirect` sin aviso) → el formulario muestra el MISMO modal «se actualizó con éxito» que Recursos y, con Continuar, vuelve a Juegos
export async function updateGameAction(type: string, form: FormData): Promise<RowResult> {
  if (!GAMES[type]) return { ok: false, message: "Juego desconocido." }; // [Fail Fast]: solo tipos del catálogo
  const text = (k: string, max: number) => String(form.get(k) ?? "").trim().slice(0, max); // `String(… ?? "")`: FormDataEntryValue | null → string
  try {
    await apiFetch(`/games/catalog/${encodeURIComponent(type)}`, {
      method: "PATCH",
      body: { title: text("title", 80), description: text("description", 240) },
      bearer: (await getCurrentAccessToken()) ?? undefined,
    });
    revalidatePath("/admin/activities");
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Crear actividad (página /admin/activities/new) ─────────────────────────
// [2026-10-24 · Crear actividad sin modales]: dos Server Actions GENÉRICAS (borrador con IA y guardar) que delegan en la estrategia del tipo (lib/activity-kinds)
// El token nunca sale del servidor: aquí se construye el ApiPort (apiFetch + Bearer) que reciben las estrategias | [Patrón]: Command + Strategy + Adapter (Port) | [Principio]: DIP + OCP + Fail Fast

type KindResult<T> = ({ ok: true } & T) | { ok: false; message: string }; // Unión discriminada por `ok` (TS)

// [apiPort]: adaptador del puerto de salida con la sesión actual | `bearer` se lee una vez por acción
async function apiPort(): Promise<ApiPort> {
  const bearer = (await getCurrentAccessToken()) ?? undefined;
  return { post: <T,>(path: string, body?: unknown) => apiFetch<T>(path, { method: "POST", body: body ?? {}, bearer }) };
}

// [editPort · 2026-10-27]: puerto con GET/POST/PATCH/DELETE para «Editar» (mismo token, una lectura por acción) | [Patrón]: Adapter
async function editPort(): Promise<EditApiPort> {
  const bearer = (await getCurrentAccessToken()) ?? undefined;
  return {
    get: <T,>(path: string) => apiFetch<T>(path, { bearer }),
    post: <T,>(path: string, body?: unknown) => apiFetch<T>(path, { method: "POST", body: body ?? {}, bearer }),
    patch: <T,>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PATCH", body: body ?? {}, bearer }),
    del: async (path: string) => {
      await apiFetch(path, { method: "DELETE", bearer });
    },
  };
}

// [cleanCtx]: idioma y nivel conocidos o vacío | [Seguridad]: los valores del cliente no se confían (las acciones son POST públicos)
const cleanCtx = (ctx: KindContext): KindContext => ({ language: isLanguage(ctx?.language) ? ctx.language : "", level: LEVEL_OPTIONS.some((l) => l.value === ctx?.level) ? ctx.level : "" });
// [cleanRecord]: solo cadenas recortadas a 20 000 caracteres (= mayor límite de los DTO) | `Object.entries` (ES2017)
const cleanRecord = (r: unknown): Record<string, string> =>
  Object.fromEntries(Object.entries(r && typeof r === "object" ? r : {}).filter(([, v]) => typeof v === "string").map(([k, v]) => [k, (v as string).slice(0, 20_000)]));
const cleanDraft = (d: ActivityDraft): ActivityDraft => ({
  title: String(d?.title ?? "").slice(0, 160),
  meta: cleanRecord(d?.meta),
  entries: (Array.isArray(d?.entries) ? d.entries : []).slice(0, 200).map(cleanRecord),
});
const fail = (err: unknown) => ({ ok: false as const, message: err instanceof Error ? err.message : String(err) });

// [draftActivityAction]: pide a NestJS el borrador de IA del tipo (práctica/diálogo → filas para revisar · gramática/poliglota → ya creado)
export async function draftActivityAction(kind: CreatableKind, ctx: KindContext, input: AiInput): Promise<KindResult<{ result: AiResult }>> {
  if (!isCreatableKind(kind)) return { ok: false, message: "Tipo de actividad no válido." };
  const c = cleanCtx(ctx);
  const topic = String(input?.topic ?? "").trim().slice(0, 160);
  if (topic.length < 2) return { ok: false, message: "Escribe el título o tema (mín. 2 caracteres) para que la IA sepa de qué trata." };
  if (kind !== "polyglot" && (!c.language || !c.level)) return { ok: false, message: "Elige idioma y nivel en el paso 1." };
  try {
    const result = await ACTIVITY_KINDS[kind].ai.run({ topic, count: Number(input?.count) || 1, sourceText: String(input?.sourceText ?? "").slice(0, 20_000), meta: cleanRecord(input?.meta) }, c, await apiPort());
    if (result.kind === "created") revalidatePath("/admin/activities");
    return { ok: true, result };
  } catch (err) {
    return fail(err);
  }
}

// [createActivityAction]: valida (mismas reglas que el formulario) y guarda con la estrategia del tipo → id + pantallas Ver/Editar
export async function createActivityAction(kind: CreatableKind, ctx: KindContext, draft: ActivityDraft): Promise<KindResult<{ id: string; warnings: string[]; href?: string }>> {
  if (!isCreatableKind(kind)) return { ok: false, message: "Tipo de actividad no válido." };
  const c = cleanCtx(ctx);
  const d = cleanDraft(draft);
  const problems = validateDraft(kind, d, c);
  if (problems.length) return { ok: false, message: problems.join(" ") };
  try {
    const { id, warnings, href } = await ACTIVITY_KINDS[kind].persist(d, c, await apiPort());
    revalidatePath("/admin/activities");
    return { ok: true, id, warnings, ...(href ? { href } : {}) };
  } catch (err) {
    return fail(err);
  }
}

// ─── Editar un juego con material propio (página /admin/activities/juegos/mazo/[id]) ─────────
// [updateDeckAction · 2026-10-27]: «Editar» de la fila del juego → mismas reglas que al crearlo (validateDraft("games")) y PATCH /games/decks/:id
// [Patrón]: Command + Adapter (borrador → cuerpo de NestJS) | [Principio]: DRY (reutiliza cleanDraft/cleanCtx/validateDraft) + Fail Fast | [Seguridad]: id con formato UUID antes de construir la ruta; NestJS exige autor o ADMIN
const DECK_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function updateDeckAction(id: string, ctx: KindContext, draft: ActivityDraft): Promise<RowResult> {
  if (!DECK_ID.test(id)) return { ok: false, message: "Juego no válido." };
  const c = cleanCtx(ctx);
  const d = cleanDraft(draft);
  const problems = validateDraft("games", d, c);
  if (problems.length) return { ok: false, message: problems.join(" ") };
  try {
    await apiFetch(`/games/decks/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: {
        title: d.title.trim(),
        gameType: d.meta.gameType || "flashcards",
        level: c.level,
        items: deckItemsOf(d.entries),
      },
      bearer: (await getCurrentAccessToken()) ?? undefined,
    });
    revalidatePath("/admin/activities");
    revalidatePath("/actividades");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// ─── Editar una actividad (página /admin/activities/editar/[tab]/[id]) ─────────
// [updateActivityAction · 2026-10-27]: «Editar» de Práctica y Diálogos en Next.js (antes el editor del remoto Angular) — mismas reglas que al crear (validateDraft)
// Lo guardado se vuelve a leer AQUÍ (no se confía en el «antes» del cliente) → el diff PATCH/POST/DELETE se calcula contra NestJS | [Patrón]: Command + Diff/Patch | [Seguridad]: UUID + NestJS exige autor o ADMIN
export async function updateActivityAction(kind: CreatableKind, id: string, ctx: KindContext, draft: ActivityDraft): Promise<RowResult> {
  const spec = isCreatableKind(kind) ? ACTIVITY_KINDS[kind].edit : undefined;
  if (!spec || !DECK_ID.test(id)) return { ok: false, message: "Actividad no válida." };
  const c = cleanCtx(ctx);
  const d = cleanDraft(draft);
  const problems = validateDraft(kind, d, c);
  if (problems.length) return { ok: false, message: problems.join(" ") };
  try {
    const api = await editPort();
    const current = spec.load(await api.get(spec.path(id))).draft;
    await spec.save(id, d, current, c, api);
    revalidatePath("/admin/activities");
    revalidatePath(`/admin/activities/ver/${kind}/${id}`);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

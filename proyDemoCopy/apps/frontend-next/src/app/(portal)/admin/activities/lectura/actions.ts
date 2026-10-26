"use server"; // [Next.js]: Server Actions → el token viaja solo en el servidor
import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api-client";
import { getCurrentAccessToken } from "@/lib/auth";
import { isReadingGenre, MAX_PARAGRAPH, MAX_PARAGRAPHS, type ReadingSentence } from "@/lib/reading";
import { LEVEL_OPTIONS } from "@/lib/languages";
// [Server Actions de Lectura · 2026-10-25]: editor de Gestión → Actividades → Lectura — metadatos, texto completo, frase a frase, completar IPA/traducción y publicar
// [Patrón]: Command + Adapter (apiFetch + Bearer) | [Principio]: SRP + Fail Fast (los valores del cliente se limpian aquí; NestJS vuelve a validar) | [Seguridad]: ids con formato UUID antes de construir la ruta

type Result<T = unknown> = ({ ok: true } & T) | { ok: false; message: string }; // Unión discriminada por `ok` (TS)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const enc = encodeURIComponent;
const fail = (err: unknown) => ({ ok: false as const, message: err instanceof Error ? err.message : String(err) });
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

// [call]: PATCH/POST con la sesión + revalidación del editor y de la tabla de Gestión
async function call<T>(id: string, path: string, method: "PATCH" | "POST", body?: unknown): Promise<T> {
  if (!UUID.test(id)) throw new Error("Lectura no válida.");
  const res = await apiFetch<T>(path, { method, body: body ?? {}, bearer: (await getCurrentAccessToken()) ?? undefined });
  revalidatePath(`/admin/activities/lectura/${id}`);
  revalidatePath("/admin/activities");
  return res;
}

export interface MetaPatch {
  title?: string;
  level?: string;
  genre?: string;
  summary?: string;
  sourceRef?: string;
}

// [updateReadingMetaAction]: título, nivel, género, resumen y fuente (solo los campos conocidos y acotados)
export async function updateReadingMetaAction(id: string, patch: MetaPatch): Promise<Result> {
  try {
    const body = {
      ...(str(patch?.title, 160) !== undefined ? { title: str(patch.title, 160) } : {}),
      ...(LEVEL_OPTIONS.some((l) => l.value === patch?.level) ? { level: patch.level } : {}),
      ...(isReadingGenre(patch?.genre) ? { genre: patch.genre } : {}),
      ...(str(patch?.summary, 600) !== undefined ? { summary: str(patch.summary, 600) } : {}),
      ...(str(patch?.sourceRef, 300) !== undefined ? { sourceRef: str(patch.sourceRef, 300) } : {}),
    };
    await call(id, `/reading/texts/${enc(id)}`, "PATCH", body);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// [replaceReadingTextAction]: texto completo → NestJS re-divide en frases (conserva traducción/IPA de las que no cambian)
export async function replaceReadingTextAction(id: string, paragraphs: string[]): Promise<Result<{ pending: number }>> {
  const clean = (Array.isArray(paragraphs) ? paragraphs : []).filter((p): p is string => typeof p === "string" && !!p.trim()).slice(0, MAX_PARAGRAPHS).map((p) => p.slice(0, MAX_PARAGRAPH));
  if (!clean.length) return { ok: false, message: "El texto está vacío." };
  try {
    const res = await call<{ pending?: number }>(id, `/reading/texts/${enc(id)}`, "PATCH", { paragraphs: clean });
    return { ok: true, pending: Number(res?.pending ?? 0) };
  } catch (err) {
    return fail(err);
  }
}

export interface SentencePatch {
  text?: string;
  translation?: string;
  ipa?: string;
  ipaUs?: string;
}

// [updateSentenceAction]: corrige una frase (si cambia el texto y no se envía IPA/traducción, NestJS las recalcula)
export async function updateSentenceAction(id: string, sentenceId: string, patch: SentencePatch): Promise<Result<{ sentence: ReadingSentence }>> {
  if (!UUID.test(sentenceId)) return { ok: false, message: "Frase no válida." };
  try {
    const body = Object.fromEntries(
      (["text", "translation", "ipa", "ipaUs"] as const).flatMap((k) => (typeof patch?.[k] === "string" ? [[k, patch[k]!.slice(0, k === "text" ? 1000 : 1500)]] : [])),
    );
    const sentence = await call<ReadingSentence>(id, `/reading/texts/${enc(id)}/sentences/${enc(sentenceId)}`, "PATCH", body);
    return { ok: true, sentence };
  } catch (err) {
    return fail(err);
  }
}

// [enrichReadingAction]: «Completar IPA y traducción» (force = recalcular las no revisadas)
export async function enrichReadingAction(id: string, force = false): Promise<Result<{ updated: number; pending: number }>> {
  try {
    const res = await call<{ updated: number; pending: number }>(id, `/reading/texts/${enc(id)}/enrich${force ? "?force=true" : ""}`, "POST");
    return { ok: true, updated: res.updated, pending: res.pending };
  } catch (err) {
    return fail(err);
  }
}

// [setReadingStatusAction]: publicar / despublicar (NestJS exige frases y título para publicar)
export async function setReadingStatusAction(id: string, publish: boolean): Promise<Result> {
  try {
    await call(id, `/reading/texts/${enc(id)}/status`, "PATCH", { status: publish ? "published" : "draft" });
    revalidatePath("/actividades");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

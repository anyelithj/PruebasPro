"use server"; // [Next.js]: Server Action → el token viaja solo en el servidor
import { revalidatePath } from "next/cache";
import { bulkPublishCurriculum, certificationPractice, createCurriculumItem, deleteCurriculumItem, listCurriculum, scanContradictions } from "@/lib/curriculum-api";
import { slugify } from "@/lib/slug"; // [Clave natural]: mismo algoritmo de slug que el backend // [Facade]: DELETE /curriculum/:id (ADMIN) y POST /curriculum/:id/status
import type { CertificationPractice, CurriculumItemKind } from "@/types/curriculum";
// [Server Actions de recursos]: acciones de fila de la tabla de Gestión | [Patrón]: Command | [Principio]: SRP

type RowResult = { ok: true } | { ok: false; message: string }; // Mismo contrato que las acciones de fila de cursos

// [runRow]: try/catch + revalidación común | [Patrón]: Template Method funcional | [Principio]: DRY
// [2026-10-24]: la revalidación va en `finally` → aunque el lote falle a medias, la tabla muestra lo que sí cambió (antes quedaba desactualizada)
async function runRow(action: () => Promise<unknown>): Promise<RowResult> {
  try {
    await action();
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  } finally {
    revalidatePath("/admin/curriculum");
    revalidatePath("/resources"); // El catálogo publicado de estudiantes
  }
}

// [deleteResourceAction]: baja definitiva + refresco del listado
export async function deleteResourceAction(id: string): Promise<RowResult> {
  return runRow(() => deleteCurriculumItem(id));
}

// [publishMany · 2026-10-24]: UNA petición a NestJS (POST /curriculum/status/bulk) recorre las transiciones de todos los ids en el servidor
// [Bug que corrige]: antes se hacían 1 GET + hasta 3 POST por recurso desde aquí → un tema de 69 palabras = ~276 peticiones → 429 «Too Many Requests» y tema «Parcial 66/69»
// [Idempotente]: lo ya publicado se omite → pulsar «Publicar» otra vez completa SOLO lo que faltó | `throw` → RowActions muestra el mensaje
async function publishMany(ids: string[], publish: boolean): Promise<void> {
  if (!ids.length) return;
  const r = await bulkPublishCurriculum(ids, publish);
  if (r.failed.length) {
    const done = r.changed + r.unchanged; // Ya en el estado pedido (nuevos + los que ya lo estaban)
    throw new Error(`${publish ? "Publicados" : "Despublicados"} ${done} de ${r.total}. ${r.failed.length} con error (vuelve a intentarlo para completar solo esos): ${r.failed[0].message}`);
  }
}

// [setResourcePublishedAction]: Publicar = recorre las transiciones hasta "aprobado" (solo ADMIN aprueba) · Despublicar = vuelve a borrador (deja de verse para estudiantes)
// [2026-10-24]: mismo endpoint en lote con un solo id → 1 petición en vez de hasta 4 | [Principio]: DRY (las reglas viven en el backend: publishSteps)
export async function setResourcePublishedAction(id: string, publish: boolean): Promise<RowResult> {
  return runRow(() => publishMany([id], publish));
}

// ───── Acciones por TEMA (grupo de la tabla de Gestión) ─────
// `export type` (TS): identifica un grupo = tema + idioma + nivel + tipo
export type TopicGroupRef = { topic: string; language: string; level: string; kind: CurriculumItemKind };

const PAGE = 100; // Máximo por página que admite GET /curriculum
// [groupIds]: ids de TODOS los recursos del grupo, página a página (antes solo los 100 primeros) | [Patrón]: Query + Iterator
async function groupIds(g: TopicGroupRef): Promise<string[]> {
  const ids: string[] = [];
  // `for (;;)` con salida explícita: hasta que la página venga incompleta o se alcance el total
  for (let page = 1; ; page++) {
    const res = await listCurriculum({ ...g, page, limit: PAGE });
    ids.push(...res.data.map((i) => i.id));
    if (res.data.length < PAGE || ids.length >= res.total) return ids;
  }
}

// [setTopicPublishedAction]: publica o despublica TODOS los recursos del tema → los estudiantes ven el tema completo | [Patrón]: Composite Command (resuelto en el servidor)
export async function setTopicPublishedAction(g: TopicGroupRef, publish: boolean): Promise<RowResult> {
  return runRow(async () => publishMany(await groupIds(g), publish));
}

// [deleteTopicAction]: elimina todos los recursos del tema (solo ADMIN; el backend lo exige)
export async function deleteTopicAction(g: TopicGroupRef): Promise<RowResult> {
  return runRow(async () => {
    for (const id of await groupIds(g)) await deleteCurriculumItem(id);
  });
}

// [scanContradictionsAction · Etapa 4]: compara las fuentes de un idioma y marca/limpia CONTRADICCION_DETECTADA | mensaje listo para mostrar (UX)
export async function scanContradictionsAction(language: string): Promise<{ ok: boolean; message: string }> {
  try {
    const r = await scanContradictions({ language });
    revalidatePath("/admin/curriculum"); // Las insignias de los recursos cambian
    return {
      ok: true,
      message: r.flagged
        ? `${r.contradictions.length} contradicción(es) entre fuentes en ${r.flagged} recurso(s) de ${r.scanned} revisados.`
        : `Sin contradicciones entre fuentes en ${r.scanned} recursos revisados${r.cleared ? ` (${r.cleared} resueltas)` : ""}.`,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

// ───── Etapa 5 · Certificaciones ─────
export type PracticeInput = { certificationId: string; level: string; skill: string; kind: string; count: number };

// [certificationPracticeAction]: borrador de ítems ORIGINALES (no se guarda) | mensaje de error listo para mostrar
export async function certificationPracticeAction(input: PracticeInput): Promise<{ ok: true; data: CertificationPractice } | { ok: false; message: string }> {
  try {
    const { certificationId, ...body } = input; // Desestructuración con resto (ES2018)
    return { ok: true, data: await certificationPractice(certificationId, body) };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

// [headlineOf]: texto principal del contenido → clave legible (mismo criterio que el titular del backend)
const headlineOf = (c: Record<string, unknown>): string =>
  [c.lemma, c.text, c.title, c.source, c.incorrect, c.prompt].find((v): v is string => typeof v === "string") ?? "item";

// [savePracticeAction]: guarda los borradores elegidos como recursos «Generado por IA» (siguen el flujo de revisión) | `for…of` secuencial: claves únicas sin carreras
export async function savePracticeAction(
  practice: Pick<CertificationPractice, "topic" | "generationId">,
  meta: { language: string; level: string; skill: string; kind: string },
  drafts: Array<{ content: Record<string, unknown>; generationId?: string }>,
): Promise<{ ok: boolean; message: string }> {
  let saved = 0;
  const errors: string[] = [];
  for (const d of drafts) {
    const key = slugify(`${practice.topic}-${headlineOf(d.content)}`).slice(0, 120).replace(/-+$/, "");
    try {
      await createCurriculumItem({ ...meta, key, topic: practice.topic, content: d.content, provenance: "generated", generationId: d.generationId ?? practice.generationId });
      saved++;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err)); // Clave repetida u otro error: se informa sin detener el resto
    }
  }
  revalidatePath("/admin/curriculum");
  return { ok: errors.length === 0, message: `${saved} recurso(s) guardado(s) como «Generado por IA»${errors.length ? ` · ${errors.length} con error: ${errors[0]}` : ""}.` };
}

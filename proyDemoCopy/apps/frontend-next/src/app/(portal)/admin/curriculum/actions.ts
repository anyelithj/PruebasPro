"use server"; // [Next.js]: Server Action → el token viaja solo en el servidor
import { revalidatePath } from "next/cache";
import { certificationPractice, changeCurriculumStatus, createCurriculumItem, deleteCurriculumItem, getCurriculumItem, listCurriculum, scanContradictions } from "@/lib/curriculum-api";
import { slugify } from "@/lib/slug"; // [Clave natural]: mismo algoritmo de slug que el backend // [Facade]: DELETE /curriculum/:id (ADMIN) y POST /curriculum/:id/status
import type { CertificationPractice, CurriculumItemKind, ReviewStatus } from "@/types/curriculum";
// [Server Actions de recursos]: acciones de fila de la tabla de Gestión | [Patrón]: Command | [Principio]: SRP

type RowResult = { ok: true } | { ok: false; message: string }; // Mismo contrato que las acciones de fila de cursos

// [runRow]: try/catch + revalidación común | [Patrón]: Template Method funcional | [Principio]: DRY
async function runRow(action: () => Promise<unknown>): Promise<RowResult> {
  try {
    await action();
    revalidatePath("/admin/curriculum");
    revalidatePath("/resources"); // El catálogo publicado de estudiantes
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

// [deleteResourceAction]: baja definitiva + refresco del listado
export async function deleteResourceAction(id: string): Promise<RowResult> {
  return runRow(() => deleteCurriculumItem(id));
}

// [Camino hasta "aprobado"]: la máquina de estados del backend no permite saltos (borrador → revisión → revisado → aprobado) | [Patrón]: Lookup Table
const PUBLISH_PATH: Readonly<Record<ReviewStatus, ReadonlyArray<ReviewStatus>>> = {
  draft: ["review_required", "reviewed", "approved"],
  generated: ["review_required", "reviewed", "approved"],
  review_required: ["reviewed", "approved"],
  reviewed: ["approved"],
  archived: ["draft", "review_required", "reviewed", "approved"],
  approved: [],
};

// [setResourcePublishedAction]: Publicar = recorre las transiciones hasta "aprobado" (solo ADMIN aprueba) · Despublicar = vuelve a borrador (deja de verse para estudiantes)
// Cada paso usa la versión devuelta por el anterior → concurrencia optimista respetada | [Patrón]: Command + Pipeline
export async function setResourcePublishedAction(id: string, publish: boolean): Promise<RowResult> {
  return runRow(() => publishOne(id, publish));
}

// [publishOne]: recorre las transiciones de UN recurso | [Principio]: DRY (fila individual y tema completo)
async function publishOne(id: string, publish: boolean): Promise<void> {
  const { item } = await getCurriculumItem(id);
  let version = item.version;
  const steps: ReadonlyArray<ReviewStatus> = publish ? PUBLISH_PATH[item.reviewStatus] : item.reviewStatus === "approved" ? ["draft"] : [];
  for (const status of steps) {
    const saved = (await changeCurriculumStatus(id, { status, expectedVersion: version })) as { version: number };
    version = saved.version;
  }
}

// ───── Acciones por TEMA (grupo de la tabla de Gestión) ─────
// `export type` (TS): identifica un grupo = tema + idioma + nivel + tipo
export type TopicGroupRef = { topic: string; language: string; level: string; kind: CurriculumItemKind };

// [groupIds]: ids de todos los recursos del grupo (máx. 100 por tema) | [Patrón]: Query
async function groupIds(g: TopicGroupRef): Promise<string[]> {
  const res = await listCurriculum({ ...g, limit: 100 });
  return res.data.map((i) => i.id);
}

// [setTopicPublishedAction]: publica o despublica TODOS los recursos del tema → los estudiantes ven el tema completo | `for…of` secuencial (respeta la concurrencia optimista de cada recurso) | [Patrón]: Composite Command
export async function setTopicPublishedAction(g: TopicGroupRef, publish: boolean): Promise<RowResult> {
  return runRow(async () => {
    for (const id of await groupIds(g)) await publishOne(id, publish);
  });
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

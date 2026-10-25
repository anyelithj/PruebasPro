"use server"; // [Next.js]: Server Actions → se ejecutan en el servidor (la cookie httpOnly viaja con la acción)

import { revalidatePath } from "next/cache";
import { runJob } from "@/lib/jobs-api";
import { ApiError } from "@/lib/errors";
// [runJobAction · Sprint 7.18]: «Ejecutar ahora» de un trabajo programado (ADMIN) | [Patrón]: Command (Server Action) | [Principio]: SRP + mínimo privilegio (NestJS exige el rol ADMIN) | [Paradigma]: Funcional + asíncrono

export type RunJobState = { ok: boolean; message: string } | null;

// `(prev, formData)`: firma de useActionState (React 19) → el formulario muestra el resultado sin JS propio
export async function runJobAction(_prev: RunJobState, formData: FormData): Promise<RunJobState> {
  const name = String(formData.get("name") ?? "");
  if (!/^[a-z0-9-]{3,60}$/.test(name)) return { ok: false, message: "Trabajo inválido" }; // [Fail Fast]
  try {
    const { jobId } = await runJob(name);
    revalidatePath("/admin/jobs"); // Relee contadores y recientes
    return { ok: true, message: `Trabajo encolado (#${jobId}). Actualiza en unos segundos para ver el resultado.` };
  } catch (err) {
    return { ok: false, message: err instanceof ApiError ? err.message : "No se pudo encolar el trabajo" };
  }
}

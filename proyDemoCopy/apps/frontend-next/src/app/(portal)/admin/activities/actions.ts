"use server"; // [Next.js]: Server Action → el token viaja solo en el servidor
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { getCurrentAccessToken } from "@/lib/auth";
import { ACTIVITY_TAB_KEYS, GAMES, removeActivity, setActivityPublished, type ActivityTab } from "@/lib/activities-api";
// [Server Actions de Actividades · 2026-10-23]: eliminar una actividad de cualquier sección desde Gestión | [Patrón]: Command | [Principio]: SRP + validación en el servidor (la pestaña llega del cliente)

type RowResult = { ok: true } | { ok: false; message: string }; // Mismo contrato que RowActions

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
    await setActivityPublished(tab, id, publish);
    revalidatePath("/admin/activities");
    revalidatePath("/actividades");
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

// [updateGameAction · 2026-10-24]: guarda título y descripción propios de un juego (formulario de /admin/activities/juegos/[type]) | `FormData` (Web API) del <form action>
// Vacío = vuelve al nombre/descr. por defecto · tras guardar → vuelve a la pestaña Juegos de Gestión | [Patrón]: Command + Post/Redirect/Get
export async function updateGameAction(type: string, form: FormData): Promise<void> {
  if (!GAMES[type]) throw new Error("Juego desconocido."); // [Fail Fast]: solo tipos del catálogo
  const text = (k: string, max: number) => String(form.get(k) ?? "").trim().slice(0, max);
  await apiFetch(`/games/catalog/${encodeURIComponent(type)}`, {
    method: "PATCH",
    body: { title: text("title", 80), description: text("description", 240) },
    bearer: (await getCurrentAccessToken()) ?? undefined,
  });
  revalidatePath("/admin/activities");
  redirect("/admin/activities?tab=games");
}

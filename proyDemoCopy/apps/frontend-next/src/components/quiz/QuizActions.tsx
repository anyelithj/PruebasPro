"use client"; // [Next.js]: Client Component → las acciones llaman a /api/quiz desde el navegador (cookies de sesión) y RowActions usa estado/diálogo
import { RowActions, type ActionResult } from "@/components/admin/RowActions";
// [QuizActions · 2026-10-28 → 2026-10-31]: en tablas Ver · Editar · Publicar · Eliminar; en el detalle Probar · Editar · Publicar · Eliminar — antes: Probar · Editar · Publicar/Despublicar · Eliminar de un examen con el MISMO comportamiento que Gestión → Recursos
// Antes tenía su propia implementación silenciosa (sin toast al publicar/eliminar y textos fijos) → ahora delega en RowActions: toast de éxito/aviso, error en línea, Dialog de confirmación e i18n (t.management.row · t.common)
// [Patrón]: Adapter (fetch REST → contrato ActionResult de RowActions) + Composition | [Principio]: DRY + DIP (RowActions recibe comandos ya enlazados) | [Paradigma]: Declarativo

export interface QuizActionsProps {
  quizId: string;
  title: string;
  isPublished: boolean;
  viewHref?: string; // [Fix 2026-10-31]: tablas → «Ver» abre el detalle | sin él (página de detalle) → «Probar»
  afterDeleteHref?: string; // [Detalle]: tras eliminar se vuelve a la lista de Gestión (el examen ya no existe)
}

// [request]: PATCH/DELETE a la ruta proxy de Next.js → ActionResult | `async` (ES2017) + try/catch: los fallos de red también llegan como mensaje (nunca una excepción sin capturar)
async function request(quizId: string, init: RequestInit): Promise<ActionResult> {
  try {
    const res = await fetch(`/api/quiz/${encodeURIComponent(quizId)}`, init); // `encodeURIComponent` (Web API): el id nunca rompe la ruta
    if (res.ok || res.status === 204) return { ok: true }; // 204 No Content = borrado correcto
    const body = (await res.json().catch(() => ({}))) as { message?: string }; // `.catch(() => ({}))`: cuerpo vacío o no-JSON → objeto vacío
    return { ok: false, message: body.message ?? `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) }; // `instanceof` (JS): estrecha el tipo `unknown`
  }
}

export function QuizActions({ quizId, title, isPublished, viewHref, afterDeleteHref }: QuizActionsProps) {
  return (
    <RowActions
      title={title}
      viewHref={viewHref}
      tryHref={viewHref ? undefined : `/quiz/${quizId}/play`} // [Probar · 2026-10-30]: desde el detalle el docente lo juega antes de publicarlo | `?:` (ternario): en tablas solo «Ver»
      editHref={`/quiz/${quizId}/edit`}
      // [Publicar / Despublicar]: un PATCH parcial { isPublished } | `() => …` (closure): RowActions solo sabe ejecutar el comando
      publish={{
        isPublished,
        toggle: () =>
          request(quizId, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isPublished: !isPublished }),
          }),
      }}
      onDelete={() => request(quizId, { method: "DELETE" })}
      deleteTitle="Eliminar examen"
      afterDeleteHref={afterDeleteHref}
    />
  );
}

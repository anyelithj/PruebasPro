"use server"; // [Next.js]: Server Action → el token viaja solo en el servidor (cookie httpOnly)
import { completeMaterial, purchaseCourse } from "./courses-api"; // [Facade]: POST /courses/:id/purchase (cursos gratuitos) y …/materials/:mid/complete
// [Server Actions de acceso a cursos]: inscribirse gratis y avanzar en la línea de tiempo | [Patrón]: Command | [Principio]: SRP | [Paradigma]: asíncrono
// [Sprint 7.4]: los cursos de pago se cobran en la pantalla Angular /checkout (Stripe) y el webhook de NestJS da el acceso

// [Resultado genérico]: datos o mensaje mostrable | `T` genérico (TS)
export type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string };

// [toResult]: envuelve la llamada y traduce el error | [Patrón]: Template Method funcional | [Principio]: DRY
async function toResult<T>(call: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await call() };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

// [enrollAction]: inscripción en un curso gratuito (mismo endpoint que la compra; el backend no cobra)
export async function enrollAction(courseId: string) {
  return toResult(() => purchaseCourse(courseId));
}

// [completeMaterialAction]: marca un material como completado → { completedMaterialIds, progress }
export async function completeMaterialAction(courseId: string, materialId: string) {
  return toResult(() => completeMaterial(courseId, materialId));
}

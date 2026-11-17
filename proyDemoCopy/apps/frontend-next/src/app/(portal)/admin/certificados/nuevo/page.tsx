import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BackLink } from "@/components/shared/BackLink";
import { getCurrentUserPayload } from "@/lib/auth";
import { getExamManage } from "@/lib/quiz-api";
import { toPortalRole } from "@/components/portal/portal-role";
import { CertActionForm } from "../CertActionForm";
import { manualIssueAction } from "../actions";
// [Página /admin/certificados/nuevo · 2026-11-11]: «Crear certificado» de Gestión → Certificados (mismo flujo que «Crear curso/recurso»: botón en la barra → página propia)
// Solo ADMIN: emisión manual como excepción (incidencia técnica o validación especial) · el docente no emite: valida el cierre académico y el sistema emite | [Principio]: mínimo privilegio

export const metadata: Metadata = { title: "Crear certificado · Gestión", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function NewCertificatePage() {
  const user = await getCurrentUserPayload();
  if (toPortalRole(user?.role ?? null) !== "admin") redirect("/admin/certificados?vista=alumnos&cierre=pending"); // Docente → su forma de «crear»: aprobar el cierre académico
  const courses = await getExamManage().catch(() => []);

  return (
    // [2026-11-16]: ancho completo (antes max-w-3xl dejaba media pantalla vacía) → alineado con el navbar y con /admin/certificados
    <div className="w-full space-y-5 py-4">
      <BackLink href="/admin/certificados" memo="certificates">Volver a certificados</BackLink>
      <header>
        <h1 className="title-page">Crear certificado</h1>
        <p className="mt-1 max-w-3xl text-muted-foreground">
          Emisión manual (excepción): no exige el 100 % del curso ni el examen final. El motivo queda en la auditoría y el certificado se ancla en Sepolia en segundo plano. Lo habitual es que el sistema lo emita solo al aprobar el examen con el cierre académico validado.
        </p>
      </header>
      <section className="surface p-5">
        <CertActionForm action={manualIssueAction} submitLabel="Emitir certificado" confirm="¿Emitir el certificado sin los requisitos habituales?">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              Correo del alumno <span className="req" aria-hidden>*</span>
              <input type="email" name="email" required maxLength={200} className="control w-full" placeholder="alumno@correo.com" />
            </label>
            <label className="space-y-1 text-sm">
              Curso <span className="req" aria-hidden>*</span>
              <select name="courseId" required className="control w-full" defaultValue="">
                <option value="" disabled>Elige el curso</option>
                {courses.map((r) => <option key={r.courseId} value={r.courseId}>{r.courseTitle}</option>)}
              </select>
            </label>
          </div>
          <label className="block space-y-1 text-sm">
            Motivo <span className="req" aria-hidden>*</span>
            <textarea name="reason" required minLength={5} maxLength={500} rows={3} className="control w-full" placeholder="p. ej. fallo técnico al guardar el examen final" />
          </label>
        </CertActionForm>
      </section>
    </div>
  );
}

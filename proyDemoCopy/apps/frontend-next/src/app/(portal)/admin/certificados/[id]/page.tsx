import { VERIFY_PREFIX } from "@/config/angular"; // [Caso E]: ruta única de verificación pública
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/shared/BackLink";
import { getCurrentUserPayload } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { getCertificateDetail } from "@/lib/quiz-api";
import { toPortalRole } from "@/components/portal/portal-role";
import { CertActionForm } from "../CertActionForm";
import { notesAction, reissueAction, revokeFormAction, revokeRequestAction } from "../actions";
// [Detalle del certificado · 2026-11-09 · RF-32]: datos del alumno y del curso, SHA-256, estado, anclaje en Sepolia (Etherscan), código y auditoría
// ADMIN: reemitir (corregir nombre/curso → nuevo PDF y hash), notas de auditoría y revocar · DOCENTE (sus cursos): ver y solicitar revocación

export const metadata: Metadata = { title: "Certificado · Gestión", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const STATUS = {
  valid: { text: "Válido", cls: "bg-tone-success-soft text-tone-success" },
  pending: { text: "Pendiente de anclaje", cls: "bg-tone-warning-soft text-tone-warning" },
  revoked: { text: "Revocado", cls: "bg-tone-danger-soft text-tone-danger" },
} as const;

const date = (s: string | null) => (s ? new Date(s).toLocaleString("es") : "—");

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[12rem_1fr]">
      <dt className="type-meta font-semibold text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export default async function CertificateDetailPage(props: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([props.params, getCurrentUserPayload()]);
  const admin = toPortalRole(user?.role ?? null) === "admin";
  let c;
  try {
    c = await getCertificateDetail(id);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 403)) notFound();
    throw err;
  }
  const st = STATUS[c.status];

  return (
    <div className="w-full space-y-5 py-4">
      <BackLink href="/admin/certificados" memo="certificates">Volver a Certificados</BackLink>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="title-page font-mono">{c.code}</h1>
        <span className={`badge ${st.cls}`}>{st.text}</span>
        {c.revokeRequestedAt && c.status !== "revoked" && <span className="badge bg-tone-warning-soft text-tone-warning">Revocación solicitada</span>}
        <a href={`${VERIFY_PREFIX}/${encodeURIComponent(c.code)}`} className="btn btn-outline btn-sm ml-auto">Verificación pública</a>
      </header>

      <section aria-labelledby="data-h" className="surface p-5">
        <h2 id="data-h" className="title-section mb-2">Datos del certificado</h2>
        <dl className="divide-y divide-border">
          <Row label="Alumno">{c.recipientName}{c.studentEmail && <span className="block type-meta text-muted-foreground">{c.studentEmail}</span>}</Row>
          <Row label="Curso / nivel">
            {c.courseId ? <Link href={`/courses/${c.courseId}`} className="hover:underline">{c.courseTitle}</Link> : c.courseTitle}
            {c.cefrLevel ? ` · ${c.cefrLevel}` : ""}
            {c.currentCourseTitle && c.currentCourseTitle !== c.courseTitle && (
              <span className="block type-meta text-muted-foreground">Nombre actual del curso: {c.currentCourseTitle}</span>
            )}
          </Row>
          <Row label="Docente">{c.teacherName ?? "—"}</Row>
          <Row label="Avance del curso">{c.progress != null ? `${c.progress} %` : "—"}</Row>
          <Row label="Nota del examen">{c.examScore != null ? `${c.examScore} %` : "—"}{c.quizId && <Link href={`/quiz/${c.quizId}`} className="ml-2 type-meta text-primary hover:underline">Ver examen</Link>}</Row>
          <Row label="Emitido">{date(c.issuedAt)}</Row>
          <Row label="Hash SHA-256 del PDF"><code className="text-xs">{c.pdfSha256}</code></Row>
          <Row label="Transacción (Sepolia)">
            {c.anchorTxHash ? (
              <a href={c.explorerUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-primary hover:underline">{c.anchorTxHash} ↗</a>
            ) : (
              <span className="text-muted-foreground">Pendiente de anclaje (el certificado se verifica por código mientras tanto)</span>
            )}
          </Row>
          {c.status === "revoked" && <Row label="Revocado">{date(c.revokedAt)} · {c.revokeReason}</Row>}
          {c.revokeRequestReason && <Row label="Solicitud del docente">{date(c.revokeRequestedAt)} · {c.revokeRequestReason}</Row>}
        </dl>
      </section>

      {admin ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {c.status !== "revoked" && (
            <section aria-labelledby="reissue-h" className="surface space-y-2 p-5">
              <h2 id="reissue-h" className="title-section">Corregir y reemitir</h2>
              <p className="type-meta text-muted-foreground">
                El PDF firmado no se puede editar sin invalidar su hash: se genera uno nuevo con los datos corregidos (nuevo código, SHA-256 y anclaje). El código anterior queda en las notas de auditoría.
              </p>
              <CertActionForm action={reissueAction} submitLabel="Reemitir certificado" confirm="Se generará un PDF y un código nuevos. ¿Continuar?">
                <input type="hidden" name="id" value={c.id} />
                <label className="block space-y-1 text-sm">Nombre del alumno<input name="recipientName" defaultValue={c.recipientName} maxLength={160} className="control w-full" /></label>
                <label className="block space-y-1 text-sm">Nombre del curso<input name="courseTitle" defaultValue={c.courseTitle} maxLength={200} className="control w-full" /></label>
                <label className="block space-y-1 text-sm">Motivo *<textarea name="reason" required minLength={5} maxLength={500} rows={2} className="control w-full" placeholder="Ej.: el nombre del alumno tenía un error ortográfico" /></label>
              </CertActionForm>
            </section>
          )}
          <section aria-labelledby="notes-h" className="surface space-y-2 p-5">
            <h2 id="notes-h" className="title-section">Notas de auditoría</h2>
            <p className="type-meta text-muted-foreground">Solo las ve el administrador; no aparecen en el PDF ni en la verificación pública.</p>
            <CertActionForm action={notesAction} submitLabel="Guardar notas">
              <input type="hidden" name="id" value={c.id} />
              <textarea name="adminNotes" defaultValue={c.adminNotes ?? ""} maxLength={2000} rows={5} className="control w-full" aria-label="Notas de auditoría" />
            </CertActionForm>
          </section>
          {c.status !== "revoked" && (
            <section aria-labelledby="revoke-h" className="surface space-y-2 border-l-4 border-l-tone-danger p-5">
              <h2 id="revoke-h" className="title-section text-tone-danger">Revocar</h2>
              <p className="type-meta text-muted-foreground">Por plagio, fraude, cancelación de matrícula o error administrativo. La verificación pública mostrará «revocado» (la transacción en Sepolia no se borra).</p>
              <CertActionForm action={revokeFormAction} submitLabel="Revocar certificado" danger confirm="La revocación es definitiva. ¿Revocar este certificado?">
                <input type="hidden" name="id" value={c.id} />
                <textarea name="reason" required minLength={3} maxLength={300} rows={2} defaultValue={c.revokeRequestReason ?? ""} className="control w-full" aria-label="Motivo de la revocación" placeholder="Motivo (lo verá quien verifique el certificado)" />
              </CertActionForm>
            </section>
          )}
        </div>
      ) : (
        c.status !== "revoked" && (
          <section aria-labelledby="request-h" className="surface space-y-2 p-5">
            <h2 id="request-h" className="title-section">Solicitar revocación</h2>
            <p className="type-meta text-muted-foreground">Solo el administrador revoca certificados. Explica el motivo académico (p. ej. trampa en el examen final); el administrador lo revisará.</p>
            <CertActionForm action={revokeRequestAction} submitLabel={c.revokeRequestedAt ? "Actualizar solicitud" : "Enviar solicitud"}>
              <input type="hidden" name="id" value={c.id} />
              <textarea name="reason" required minLength={10} maxLength={1000} rows={3} defaultValue={c.revokeRequestReason ?? ""} className="control w-full" aria-label="Justificación" />
            </CertActionForm>
          </section>
        )
      )}
    </div>
  );
}

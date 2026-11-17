"use server"; // [Server Actions · 2026-11-06]: Gestión → Certificados (el token nunca llega al cliente)
import { revalidatePath } from "next/cache";
import { approveClosure, setFinalGrade, issueCertificateManually, resetExamAttempts, saveCertificateTemplate, reissueCertificate, requestCertificateRevocation, revokeCertificate, updateCertificateNotes } from "@/lib/quiz-api";

// ───── [Gestión de certificados · 2026-11-09 · RF-32]: formularios (useActionState) — ADMIN emite, reemite, anota y revoca · DOCENTE solicita revocar ─────
export type CertFormResult = { ok: boolean; message: string } | null;

const field = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const UUID = /^[0-9a-f-]{36}$/i;

const runForm = async (action: () => Promise<unknown>, ok: string, path?: string): Promise<CertFormResult> => {
  try {
    await action();
    revalidatePath("/admin/certificados");
    if (path) revalidatePath(path);
    return { ok: true, message: ok };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
};

export async function manualIssueAction(_: CertFormResult, fd: FormData): Promise<CertFormResult> {
  const [email, courseId, reason] = [field(fd, "email"), field(fd, "courseId"), field(fd, "reason")];
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, message: "Escribe el correo del alumno." };
  if (!UUID.test(courseId)) return { ok: false, message: "Elige el curso." };
  if (reason.length < 5) return { ok: false, message: "Explica el motivo de la emisión manual (mín. 5 caracteres)." };
  return runForm(() => issueCertificateManually(email, courseId, reason), "Certificado emitido. Se anclará en Sepolia en segundo plano.");
}

export async function reissueAction(_: CertFormResult, fd: FormData): Promise<CertFormResult> {
  const [id, recipientName, courseTitle, reason] = [field(fd, "id"), field(fd, "recipientName"), field(fd, "courseTitle"), field(fd, "reason")];
  if (!UUID.test(id)) return { ok: false, message: "Certificado no válido." };
  if (reason.length < 5) return { ok: false, message: "Explica el motivo de la corrección (mín. 5 caracteres)." };
  return runForm(
    () => reissueCertificate(id, { recipientName: recipientName || undefined, courseTitle: courseTitle || undefined, reason }),
    "Certificado reemitido: nuevo PDF, código y hash. El código anterior deja de ser válido.",
    `/admin/certificados/${id}`,
  );
}

export async function notesAction(_: CertFormResult, fd: FormData): Promise<CertFormResult> {
  const id = field(fd, "id");
  if (!UUID.test(id)) return { ok: false, message: "Certificado no válido." };
  return runForm(() => updateCertificateNotes(id, field(fd, "adminNotes").slice(0, 2000)), "Notas guardadas.", `/admin/certificados/${id}`);
}

export async function revokeFormAction(_: CertFormResult, fd: FormData): Promise<CertFormResult> {
  const [id, reason] = [field(fd, "id"), field(fd, "reason")];
  if (!UUID.test(id)) return { ok: false, message: "Certificado no válido." };
  if (reason.length < 3) return { ok: false, message: "Escribe el motivo de la revocación." };
  return runForm(() => revokeCertificate(id, reason), "Certificado revocado: la verificación pública ya lo indica.", `/admin/certificados/${id}`);
}

export async function revokeRequestAction(_: CertFormResult, fd: FormData): Promise<CertFormResult> {
  const [id, reason] = [field(fd, "id"), field(fd, "reason")];
  if (!UUID.test(id)) return { ok: false, message: "Certificado no válido." };
  if (reason.length < 10) return { ok: false, message: "Justifica la solicitud (mín. 10 caracteres)." };
  return runForm(() => requestCertificateRevocation(id, reason), "Solicitud enviada al administrador.", `/admin/certificados/${id}`);
}

// [2026-11-09 · RF-32]: restablecer intentos de examen (ADMIN, incidencia técnica) y plantilla del PDF
export async function resetAttemptsAction(_: CertFormResult, fd: FormData): Promise<CertFormResult> {
  const [quizId, userId, reason] = [field(fd, "quizId"), field(fd, "userId"), field(fd, "reason")];
  if (!UUID.test(quizId) || !UUID.test(userId)) return { ok: false, message: "Intento no válido." };
  if (reason.length < 5) return { ok: false, message: "Explica el motivo (mín. 5 caracteres)." };
  try {
    const r = await resetExamAttempts(quizId, userId, reason);
    revalidatePath("/admin/certificados");
    return { ok: true, message: r.voided ? `${r.voided} intento(s) anulado(s): el alumno vuelve a tener 3 sin espera.` : "No había intentos suspendidos que anular." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

// [2026-11-09 · RF-32]: el docente valida el cierre académico (o corrige la nota) → si el alumno cumple, NestJS emite el certificado al momento
const outcome = (r: { certificate: { code: string } | null; pending: string | null }, done: string): CertFormResult =>
  r.certificate ? { ok: true, message: `${done} Certificado emitido: ${r.certificate.code}.` } : { ok: true, message: `${done} ${r.pending ?? ""}`.trim() };

export async function closureAction(_: CertFormResult, fd: FormData): Promise<CertFormResult> {
  const [userId, courseId, approve] = [field(fd, "userId"), field(fd, "courseId"), field(fd, "approve") === "true"];
  if (!UUID.test(userId) || !UUID.test(courseId)) return { ok: false, message: "Alumno o curso no válido." };
  try {
    const r = await approveClosure(userId, courseId, approve);
    revalidatePath("/admin/certificados");
    return outcome(r, approve ? "Cierre académico aprobado." : "Cierre académico retirado.");
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

export async function gradeAction(_: CertFormResult, fd: FormData): Promise<CertFormResult> {
  const [userId, courseId, raw, note] = [field(fd, "userId"), field(fd, "courseId"), field(fd, "grade"), field(fd, "note")];
  if (!UUID.test(userId) || !UUID.test(courseId)) return { ok: false, message: "Alumno o curso no válido." };
  const grade = raw === "" ? null : Number(raw);
  if (grade != null && (!Number.isInteger(grade) || grade < 0 || grade > 100)) return { ok: false, message: "La nota va de 0 a 100." };
  if (note.length < 5) return { ok: false, message: "Explica el motivo de la corrección (mín. 5 caracteres)." };
  try {
    const r = await setFinalGrade(userId, courseId, grade, note);
    revalidatePath("/admin/certificados");
    return outcome(r, "Nota guardada.");
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

export async function templateAction(_: CertFormResult, fd: FormData): Promise<CertFormResult> {
  const institution = field(fd, "institution");
  if (institution.length < 2) return { ok: false, message: "Escribe el nombre de la institución." };
  return runForm(
    () => saveCertificateTemplate({ institution, signerName: field(fd, "signerName"), signerTitle: field(fd, "signerTitle"), legalText: field(fd, "legalText") }),
    "Plantilla guardada. Se aplica a los certificados que se emitan o reemitan desde ahora.",
  );
}

// [revokeRowAction · 2026-11-11]: «Eliminar» de la fila (RowActions, mismo diseño que Cursos/Recursos) → ADMIN revoca · docente solicita la revocación al administrador
// [Seguridad]: el rol lo vuelve a comprobar NestJS (PATCH /revoke solo ADMIN) | contrato ActionResult de RowActions
export async function revokeRowAction(id: string, asAdmin: boolean, reason?: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const fd = new FormData();
  fd.set("id", id);
  fd.set("reason", reason ?? "");
  const r = await (asAdmin ? revokeFormAction : revokeRequestAction)(null, fd);
  return r?.ok ? { ok: true } : { ok: false, message: r?.message ?? "No se pudo completar." };
}

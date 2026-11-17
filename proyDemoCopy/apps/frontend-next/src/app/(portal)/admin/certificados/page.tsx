import { VERIFY_PREFIX } from "@/config/angular"; // [Caso E]: ruta única de verificación pública
import type { Metadata } from "next";
import Link from "next/link";
import { Award, FileCheck2, GraduationCap, Plus } from "lucide-react";
import { getCurrentUserPayload } from "@/lib/auth";
import { getCertificateTemplate, getExamAttempts, getExamManage, getIssuedCertificates } from "@/lib/quiz-api";
import { languageLabel } from "@/lib/languages";
import { toPortalRole } from "@/components/portal/portal-role";
import { ManagementHeader } from "@/components/portal/ManagementHeader";
import { RememberReturn } from "@/components/shared/RememberReturn";
import { RowActions } from "@/components/admin/RowActions"; // MISMOS botones Ver · Editar · Eliminar que Cursos, Exámenes, Recursos y Actividades
import { FilterField, FilterPanel } from "@/components/admin/FilterPanel"; // MISMO panel de filtros que el resto de Gestión
import { Pagination, paginate } from "@/components/shared/Pagination";
import type { ExamAttemptRow, ExamManageRow, IssuedCertificate } from "@/types/quiz";
import { CertActionForm } from "./CertActionForm";
import { closureAction, gradeAction, resetAttemptsAction, revokeRowAction, templateAction } from "./actions";
// [Gestión → Certificados · 2026-11-06]: certificados emitidos, alumnos al 100 % (cierre académico y nota) y examen final de cada curso
// [2026-11-11 · Uniformidad]: antes las TRES tablas iban una debajo de otra, cada una con botones y filtros propios y con otro estilo
// → ahora son PESTAÑAS (?vista=) con el MISMO diseño que Cursos, Exámenes, Recursos y Actividades: barra (resumen + botón primario) · chips de pestaña ·
//   FilterPanel (Filtrar / Limpiar) · tabla (thead, filas, RowActions) · Pagination
// ADMIN: todos los cursos y certificados (crear, editar/reemitir, revocar) · docente: sus cursos (ver, aprobar cierre, editar nota, solicitar revocación)
// [Patrón]: Container (RSC) + URL State (?vista=&…) + Configuration Object (VIEWS) | [Principio]: DRY (FilterPanel, RowActions, Pagination) + SRP (una tabla por pestaña)

export const metadata: Metadata = { title: "Certificados · Gestión", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type View = "emitidos" | "alumnos" | "examenes";
interface SearchParams {
  vista?: string;
  page?: string;
  curso?: string; // Curso recién creado → se resalta en «Exámenes finales»
  // Emitidos
  search?: string;
  estado?: string;
  cursoCert?: string;
  desde?: string;
  hasta?: string;
  // Alumnos
  alumno?: string;
  cierre?: string;
  // Exámenes
  examen?: string;
  estadoExamen?: string;
}

const VIEWS: Record<View, { label: string; icon: typeof Award }> = {
  emitidos: { label: "Certificados emitidos", icon: Award },
  alumnos: { label: "Alumnos al 100 % y cierre académico", icon: GraduationCap },
  examenes: { label: "Exámenes finales de los cursos", icon: FileCheck2 },
};
const parseView = (v?: string, curso?: string): View => (v && v in VIEWS ? (v as View) : curso ? "examenes" : "emitidos"); // ?curso= (curso recién creado) → su examen

const STATE: Record<ExamManageRow["state"], { text: string; cls: string }> = {
  ready: { text: "Examen listo", cls: "bg-tone-brand-soft text-tone-brand" },
  generating: { text: "Generando…", cls: "bg-tone-info-soft text-tone-info" },
  error: { text: "Error al generar", cls: "bg-tone-danger-soft text-tone-danger" },
  missing: { text: "Sin examen", cls: "bg-tone-warning-soft text-tone-warning" },
};

// [Filtros de la bandeja · 2026-11-09 · RF-32]
const CERT_STATUS = [
  { value: "issued", label: "Válidos" },
  { value: "pending", label: "Pendientes de anclaje" },
  { value: "requested", label: "Revocación solicitada" },
  { value: "revoked", label: "Revocados" },
];
const CLOSURE = [
  { value: "pending", label: "Por validar (curso al 100 %)" },
  { value: "approved", label: "Validado" },
  { value: "certified", label: "Con certificado" },
];

// [href]: URL de la pestaña conservando filtros | sin claves vacías → URL limpia
const href = (sp: SearchParams, patch: Partial<SearchParams>) => ({
  pathname: "/admin/certificados",
  query: Object.fromEntries(Object.entries({ ...sp, page: undefined, ...patch }).filter(([, v]) => v)) as Record<string, string>,
});

// [Filtros en servidor de alumnos y exámenes]: NestJS no los ofrece → se aplican a la lista ya cargada | Funciones puras
const has = (text: string | null | undefined, q?: string) => !q || (text ?? "").toLowerCase().includes(q.toLowerCase());
const closureOf = (a: ExamAttemptRow) => (a.certificateCode ? "certified" : a.closureApprovedAt ? "approved" : a.kind === "final" && (a.progress ?? 0) >= 100 ? "pending" : "");

const th = "px-4 py-3";
const td = "px-4 py-2";

export default async function AdminCertificatesPage(props: { searchParams: Promise<SearchParams> }) {
  const [sp, user] = await Promise.all([props.searchParams, getCurrentUserPayload()]);
  const role = toPortalRole(user?.role ?? null);
  const isAdmin = role === "admin";
  const view = parseView(sp.vista, sp.curso);
  const failed: string[] = []; // [2026-11-10]: un fallo de la API se dice (antes la página quedaba vacía y sin botones)
  // Los cursos (exámenes) siempre se cargan: alimentan el select «Curso» de Emitidos y la pestaña Exámenes
  const [exams, certs, attempts, template] = await Promise.all([
    getExamManage().catch((e: unknown) => (e instanceof Error ? e : new Error(String(e)))),
    view === "emitidos"
      ? getIssuedCertificates({ search: sp.search, status: sp.estado, courseId: sp.cursoCert, from: sp.desde, to: sp.hasta }).catch((): IssuedCertificate[] => { failed.push("certificados emitidos"); return []; })
      : ([] as IssuedCertificate[]),
    view === "alumnos" ? getExamAttempts(sp.alumno ?? "").catch((): ExamAttemptRow[] => { failed.push("exámenes por alumno"); return []; }) : ([] as ExamAttemptRow[]),
    isAdmin && view === "emitidos" ? getCertificateTemplate().catch(() => null) : null,
  ]);
  const courses = exams instanceof Error ? [] : exams;
  if (exams instanceof Error && view === "examenes") failed.push(`exámenes finales (${exams.message})`);
  const fresh = sp.curso ? courses.find((r) => r.courseId === sp.curso) : undefined;

  const examRows = courses.filter((r) => has(`${r.courseTitle} ${r.language ?? ""} ${r.cefrLevel ?? ""}`, sp.examen) && (!sp.estadoExamen || r.state === sp.estadoExamen));
  const studentRows = attempts.filter((a) => !sp.cierre || closureOf(a) === sp.cierre);
  const list = view === "emitidos" ? certs : view === "alumnos" ? studentRows : examRows;
  const pg = paginate<IssuedCertificate | ExamAttemptRow | ExamManageRow>(list, sp.page);
  const Icon = VIEWS[view].icon;

  // [Barra]: resumen + contador a la izquierda y UN botón primario a la derecha (como «Crear curso/recurso/actividad»)
  const summary: Record<View, string> = {
    emitidos: isAdmin ? "Ver: hash, PDF y anclaje en Sepolia · Editar: corregir y reemitir · Revocar: definitivo y público." : "Ver: progreso, PDF y anclaje en Sepolia · Editar: corrige la nota del alumno · Solicitar revocación al administrador con la justificación.",
    alumnos: isAdmin
      ? "Alumnos con el curso al 100 % o que ya presentaron un examen. Ante un problema técnico, restablece sus intentos (los suspendidos se anulan y quedan en la auditoría)."
      : "Alumnos de tus cursos que completaron el 100 % o presentaron el examen final. Valida su cierre académico (requisito para emitir el certificado) y corrige la nota si hace falta.",
    examenes: "Aprobar con 70 % · 3 intentos (10 min entre intentos, 24 h tras 3 suspensos). Al aprobar y validar el cierre, el certificado se emite solo.",
  };
  const unit: Record<View, [string, string]> = { emitidos: ["certificado", "certificados"], alumnos: ["alumno", "alumnos"], examenes: ["curso", "cursos"] };
  const primary =
    view === "emitidos" ? (
      isAdmin ? (
        <Link href="/admin/certificados/nuevo" className="btn btn-primary"><Plus aria-hidden className="size-4" /> Crear certificado</Link>
      ) : (
        <Link href={href({}, { vista: "alumnos", cierre: "pending" })} className="btn btn-primary"><Plus aria-hidden className="size-4" /> Aprobar cierre académico</Link>
      )
    ) : view === "alumnos" ? (
      <Link href={href({}, { vista: "alumnos", cierre: "pending" })} className="btn btn-primary">Pendientes de validar</Link>
    ) : (
      <Link href="/quiz/create" className="btn btn-primary"><Plus aria-hidden className="size-4" /> Crear examen</Link>
    );

  return (
    <div className="w-full space-y-5 py-4">
      <RememberReturn memo="certificates" />
      <ManagementHeader role={role} active="certificates" />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-2xl text-muted-foreground">
          {summary[view]}{" "}
          <b className="text-foreground">{list.length} {unit[view][list.length === 1 ? 0 : 1]}</b>.
        </p>
        <div className="flex flex-wrap gap-2">
          {view === "emitidos" && isAdmin && template && <a href="#cert-template" className="btn btn-outline">Plantilla del PDF</a>}
          {primary}
        </div>
      </div>

      {/* [Pestañas]: chips con icono y aria-current (navegables sin JS), como las secciones de Actividades */}
      <nav aria-label="Vista de certificados" className="flex flex-wrap gap-1.5">
        {(Object.keys(VIEWS) as View[]).map((k) => {
          const I = VIEWS[k].icon;
          return (
            <Link key={k} href={href({}, { vista: k })} aria-current={k === view ? "page" : undefined} className="chip">
              <I aria-hidden className="size-4" /> {VIEWS[k].label}
            </Link>
          );
        })}
      </nav>

      {failed.length > 0 && (
        <p role="alert" className="rounded-lg border border-tone-danger-line bg-tone-danger-soft p-4 text-tone-danger">
          No se pudo cargar: {failed.join(", ")}. Revisa que el backend esté encendido y recarga.
        </p>
      )}

      {/* ── Filtros (MISMO panel que el resto de Gestión) ── */}
      {view === "emitidos" && (
        <FilterPanel
          label="Filtros de certificados"
          clearHref={href({}, { vista: "emitidos" })}
          hidden={{ vista: "emitidos" }}
          search={{ value: sp.search, placeholder: "Código, alumno, curso o docente" }}
          selects={[
            { name: "estado", label: "Estado", value: sp.estado, all: "Todos", options: CERT_STATUS },
            { name: "cursoCert", label: "Curso", value: sp.cursoCert, all: "Todos", options: courses.map((r) => ({ value: r.courseId, label: r.courseTitle })) },
          ]}
          extraKey={`${sp.desde ?? ""}|${sp.hasta ?? ""}`}
        >
          <FilterField name="desde" label="Desde">
            <input id="f-desde" type="date" name="desde" defaultValue={sp.desde ?? ""} className="control w-full" />
          </FilterField>
          <FilterField name="hasta" label="Hasta">
            <input id="f-hasta" type="date" name="hasta" defaultValue={sp.hasta ?? ""} className="control w-full" />
          </FilterField>
        </FilterPanel>
      )}
      {view === "alumnos" && (
        <FilterPanel
          label="Filtros de alumnos"
          clearHref={href({}, { vista: "alumnos" })}
          hidden={{ vista: "alumnos" }}
          search={{ name: "alumno", value: sp.alumno, placeholder: "Alumno, correo, curso o examen" }}
          selects={[{ name: "cierre", label: "Cierre académico", value: sp.cierre, all: "Todos", options: CLOSURE }]}
        />
      )}
      {view === "examenes" && (
        <FilterPanel
          label="Filtros de exámenes finales"
          clearHref={href({}, { vista: "examenes" })}
          hidden={{ vista: "examenes" }}
          search={{ name: "examen", value: sp.examen, placeholder: "Curso, idioma o nivel" }}
          selects={[{ name: "estadoExamen", label: "Estado", value: sp.estadoExamen, all: "Todos", options: (Object.keys(STATE) as ExamManageRow["state"][]).map((k) => ({ value: k, label: STATE[k].text })) }]}
        />
      )}

      {view === "examenes" && fresh && !fresh.quizId && (
        <p role="status" className="rounded-lg border border-tone-info-line bg-tone-info-soft px-4 py-3 text-tone-info">
          Curso creado: <b>{fresh.courseTitle}</b>. Crea ahora su examen final: sin examen no se puede publicar.{" "}
          <Link href={`/quiz/create?curso=${encodeURIComponent(fresh.courseId)}`} className="font-semibold underline">Crear examen</Link>
        </p>
      )}

      {view === "emitidos" && isAdmin && template && (
        <details id="cert-template" className="surface scroll-mt-20 p-4">
          <summary className="cursor-pointer font-semibold">Plantilla del certificado (PDF)</summary>
          <p className="mt-1 type-meta text-muted-foreground">Institución, firma autorizada y texto legal impresos en el PDF. Se aplica a los que se emitan o reemitan desde ahora: los ya emitidos no cambian (su hash está anclado).</p>
          <div className="mt-3">
            <CertActionForm action={templateAction} submitLabel="Guardar plantilla">
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="space-y-1 text-sm">Institución *<input name="institution" required minLength={2} maxLength={80} defaultValue={template.institution} className="control w-full" /></label>
                <label className="space-y-1 text-sm">Firma: nombre<input name="signerName" maxLength={120} defaultValue={template.signerName ?? ""} className="control w-full" placeholder="Ej.: Laura Gómez" /></label>
                <label className="space-y-1 text-sm">Firma: cargo<input name="signerTitle" maxLength={120} defaultValue={template.signerTitle ?? ""} className="control w-full" placeholder="Ej.: Directora académica" /></label>
              </div>
              <label className="block space-y-1 text-sm">Texto legal<textarea name="legalText" maxLength={400} rows={2} defaultValue={template.legalText ?? ""} className="control w-full" placeholder="Ej.: Certificado expedido conforme al reglamento académico…" /></label>
            </CertActionForm>
          </div>
        </details>
      )}

      {/* ── Tabla (MISMO estilo que Cursos, Recursos y Actividades) ── */}
      {list.length === 0 ? (
        <div role="status" className="surface p-10 text-center">
          <Icon aria-hidden className="mx-auto size-10 text-tone-brand" />
          <p className="mt-2 text-muted-foreground">
            {view === "emitidos" ? "No hay certificados con estos filtros." : view === "alumnos" ? "Ningún alumno con estos filtros ha llegado aún al examen." : "No hay cursos con estos filtros."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              {view === "emitidos" ? (
                <tr>
                  <th scope="col" className={th}>Código</th>
                  <th scope="col" className={th}>Alumno</th>
                  <th scope="col" className={th}>Curso · nivel</th>
                  <th scope="col" className={th}>Nota</th>
                  <th scope="col" className={th}>Fecha</th>
                  <th scope="col" className={th}>Estado</th>
                  <th scope="col" className={th}>Acciones</th>
                </tr>
              ) : view === "alumnos" ? (
                <tr>
                  <th scope="col" className={th}>Alumno</th>
                  <th scope="col" className={th}>Examen</th>
                  <th scope="col" className={th}>Avance</th>
                  <th scope="col" className={th}>Intentos</th>
                  <th scope="col" className={th}>Nota</th>
                  <th scope="col" className={th}>Estado</th>
                  <th scope="col" className={th}>Cierre académico</th>
                  <th scope="col" className={th}>Acciones</th>
                </tr>
              ) : (
                <tr>
                  <th scope="col" className={th}>Curso</th>
                  <th scope="col" className={th}>Idioma · nivel</th>
                  <th scope="col" className={th}>Estado</th>
                  <th scope="col" className={th}>Preguntas</th>
                  <th scope="col" className={th}>Aprobados</th>
                  <th scope="col" className={th}>Acciones</th>
                </tr>
              )}
            </thead>
            <tbody>
              {view === "emitidos" && (pg.rows as IssuedCertificate[]).map((c) => <CertRow key={c.id} c={c} isAdmin={isAdmin} />)}
              {view === "alumnos" && (pg.rows as ExamAttemptRow[]).map((a) => <StudentRow key={`${a.userId}:${a.quizId}`} a={a} isAdmin={isAdmin} />)}
              {view === "examenes" &&
                (pg.rows as ExamManageRow[]).map((r) => (
                  <tr key={r.courseId} className={`border-t border-border hover:bg-muted/40 ${r.courseId === sp.curso ? "bg-tone-brand-soft/40" : ""}`}>
                    <td className={td}>
                      <Link href={`/courses/${r.courseId}`} className="flex items-center gap-2 font-semibold text-primary hover:underline">
                        <FileCheck2 aria-hidden className="size-5 shrink-0" /> {r.courseTitle}
                      </Link>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      {r.language ? languageLabel(r.language) : "—"} · <b>{r.cefrLevel ?? "—"}</b>
                      <span className="block type-meta text-muted-foreground">Curso {r.published ? "publicado" : "en borrador"}</span>
                    </td>
                    <td className={td}>
                      <span className={`badge ${STATE[r.state].cls}`}>{STATE[r.state].text}</span>
                      {r.message && <span className="block type-meta text-tone-danger">{r.message}</span>}
                    </td>
                    <td className={`${td} tabular-nums`}>{r.quizId ? r.questions : "—"}</td>
                    <td className={`${td} tabular-nums`}>{r.quizId ? r.passed : "—"}</td>
                    <td className={td}>
                      {r.quizId ? (
                        <RowActions title={`Examen final · ${r.courseTitle}`} viewHref={`/quiz/${r.quizId}`} editHref={`/quiz/${r.quizId}/edit`} deleteTitle="" />
                      ) : r.state === "generating" ? (
                        <span className="type-meta text-muted-foreground">La IA está trabajando…</span>
                      ) : (
                        <Link href={`/quiz/create?curso=${encodeURIComponent(r.courseId)}`} className="btn btn-primary btn-sm"><Plus aria-hidden className="size-4" /> Crear examen</Link>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={pg.page} pages={pg.pages} pathname="/admin/certificados" query={{ ...sp }} />
    </div>
  );
}

// [CertRow]: certificado emitido — Ver (hash, PDF, Sepolia, progreso) · Editar (ADMIN reemite · docente corrige la nota) · Revocar / Solicitar revocación · PDF · Verificar
function CertRow({ c, isAdmin }: { c: IssuedCertificate; isAdmin: boolean }) {
  return (
    <tr className="border-t border-border hover:bg-muted/40">
      <td className={`${td} font-mono text-xs`}>
        <Link href={`/admin/certificados/${c.id}`} className="flex items-center gap-2 font-semibold text-primary hover:underline">
          <Award aria-hidden className="size-5 shrink-0" /> {c.code}
        </Link>
      </td>
      <td className={td}>{c.recipientName}</td>
      <td className={td}>
        {c.courseTitle}
        {c.cefrLevel && <> · <b>{c.cefrLevel}</b></>}
        {c.teacherName && <span className="block type-meta text-muted-foreground">{c.teacherName}</span>}
      </td>
      <td className={`${td} tabular-nums`}>{c.examScore != null ? `${c.examScore} %` : "—"}</td>
      <td className={`${td} whitespace-nowrap`}>{new Date(c.issuedAt).toLocaleDateString("es")}</td>
      <td className={td}>
        {c.status === "revoked" ? (
          <span className="badge bg-tone-danger-soft text-tone-danger" title={c.revokeReason ?? undefined}>Revocado</span>
        ) : (
          <span className="flex flex-wrap items-center gap-1">
            {c.anchorTxHash ? <span className="badge bg-tone-brand-soft text-tone-brand">Válido</span> : <span className="badge bg-tone-warning-soft text-tone-warning">Pendiente de anclaje</span>}
            {c.revokeRequestReason && <span className="badge bg-tone-danger-soft text-tone-danger" title={c.revokeRequestReason}>Revocación solicitada</span>}
          </span>
        )}
      </td>
      <td className={td}>
        <div className="flex flex-wrap items-center gap-2">
          <RowActions
            title={`${c.code} · ${c.recipientName}`}
            viewHref={`/admin/certificados/${c.id}`}
            editHref={isAdmin ? `/admin/certificados/${c.id}#reissue-h` : `/admin/certificados?vista=alumnos&alumno=${encodeURIComponent(c.recipientName)}`}
            onDelete={c.status !== "revoked" && !(!isAdmin && c.revokeRequestReason) ? revokeRowAction.bind(null, c.id, isAdmin) : undefined}
            deleteLabel={isAdmin ? "Revocar" : "Solicitar revocación"}
            deleteTitle={isAdmin ? `Revocar «${c.code}» · definitivo y público en la verificación` : `Solicitar revocación de «${c.code}» al administrador`}
            deleteReason={isAdmin ? { label: "Motivo de la revocación", min: 3 } : { label: "Justificación académica (p. ej. trampa en el examen final)", min: 10 }}
          />
          <a href={`/api/certificates/${c.id}/pdf`} className="btn btn-outline btn-sm" download>PDF</a>
          <a href={`${VERIFY_PREFIX}/${encodeURIComponent(c.code)}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">Verificar</a>
        </div>
      </td>
    </tr>
  );
}

// [StudentRow · RF-32 · Emisión condicionada]: certificado de curso = 100 % + examen (o nota corregida) ≥ 70 % + CIERRE ACADÉMICO validado por el docente
// «Aprobar cierre» es el gatillo: si ya cumple, NestJS emite el certificado · «Editar nota» recalcula la elegibilidad · ADMIN restablece intentos
function StudentRow({ a, isAdmin }: { a: ExamAttemptRow; isAdmin: boolean }) {
  const course = a.kind === "final" && a.courseId ? a.courseId : null;
  return (
    <tr className="border-t border-border align-top hover:bg-muted/40">
      <td className={td}>
        <span className="flex items-center gap-2 font-semibold"><GraduationCap aria-hidden className="size-5 shrink-0 text-tone-brand" /> {a.studentName}</span>
        {a.studentEmail && <span className="block type-meta text-muted-foreground">{a.studentEmail}</span>}
      </td>
      <td className={td}>
        <span className={`badge mr-1 ${a.kind === "final" ? "bg-tone-brand-soft text-tone-brand" : "bg-tone-info-soft text-tone-info"}`}>{a.kind === "final" ? "Final de curso" : "Nivel"}</span>
        {a.courseTitle ?? a.examTitle}
      </td>
      <td className={`${td} tabular-nums`}>{a.progress != null ? `${a.progress} %` : "—"}</td>
      <td className={`${td} tabular-nums`}>
        {a.attemptsUsed}
        {a.voided > 0 && <span className="block type-meta text-muted-foreground">{a.voided} anulado(s)</span>}
      </td>
      <td className={`${td} tabular-nums`}>
        {a.finalGrade != null ? (
          <>
            <span className="font-semibold" title={a.gradeNote ?? undefined}>{a.finalGrade} %</span>
            <span className="block type-meta text-muted-foreground">corregida · examen {a.bestPercent ?? "—"} %</span>
          </>
        ) : a.bestPercent != null ? `${a.bestPercent} %` : "—"}
      </td>
      <td className={td}>
        {a.certificateCode ? (
          <span className="badge bg-tone-success-soft text-tone-success">Certificado · {a.certificateCode}</span>
        ) : a.passed || (a.finalGrade ?? 0) >= 70 ? (
          <span className="badge bg-tone-warning-soft text-tone-warning">{course && !a.closureApprovedAt ? "Aprobado · falta validar el cierre" : "Aprobado sin certificado"}</span>
        ) : a.inProgress ? (
          <span className="badge bg-tone-info-soft text-tone-info">Presentando</span>
        ) : a.retryAt ? (
          <span className="badge bg-tone-warning-soft text-tone-warning">En espera hasta {new Date(a.retryAt).toLocaleString("es")}</span>
        ) : a.attemptsUsed ? (
          <span className="badge bg-muted text-muted-foreground">Puede reintentar</span>
        ) : (
          <span className="badge bg-muted text-muted-foreground">Sin intentos</span>
        )}
      </td>
      <td className={td}>
        {!course ? (
          <span className="type-meta text-muted-foreground">No aplica</span>
        ) : a.closureApprovedAt ? (
          <span className="flex flex-wrap items-center gap-1">
            <span className="badge bg-tone-success-soft text-tone-success">Validado · {new Date(a.closureApprovedAt).toLocaleDateString("es")}</span>
            {!a.certificateCode && (
              <CertActionForm action={closureAction} submitLabel="Retirar" danger>
                <input type="hidden" name="userId" value={a.userId} />
                <input type="hidden" name="courseId" value={course} />
                <input type="hidden" name="approve" value="false" />
              </CertActionForm>
            )}
          </span>
        ) : (a.progress ?? 0) >= 100 ? (
          <CertActionForm action={closureAction} submitLabel="Aprobar cierre" confirm="¿Validar el cierre académico? Si el alumno ya aprobó, se emite su certificado.">
            <input type="hidden" name="userId" value={a.userId} />
            <input type="hidden" name="courseId" value={course} />
            <input type="hidden" name="approve" value="true" />
          </CertActionForm>
        ) : (
          <span className="type-meta text-muted-foreground">Curso al {a.progress ?? 0} %</span>
        )}
      </td>
      <td className={td}>
        <span className="flex flex-wrap items-start gap-2">
          {/* Ver: el certificado emitido (detalle con PDF, código y Sepolia) */}
          {a.certificateCode && (
            <Link href={`/admin/certificados?vista=emitidos&search=${encodeURIComponent(a.certificateCode)}`} className="btn btn-outline btn-sm">Ver certificado</Link>
          )}
          {course && !a.certificateCode && (
            <details>
              <summary className="btn btn-outline btn-sm cursor-pointer">Editar nota</summary>
              <div className="mt-2 w-64">
                <CertActionForm action={gradeAction} submitLabel="Guardar nota">
                  <input type="hidden" name="userId" value={a.userId} />
                  <input type="hidden" name="courseId" value={course} />
                  <label className="block space-y-1 text-sm">
                    Nota final (0–100 · vacía = la del examen)
                    <input type="number" name="grade" min={0} max={100} step={1} defaultValue={a.finalGrade ?? a.bestPercent ?? ""} className="control w-full" />
                  </label>
                  <textarea name="note" required minLength={5} maxLength={500} rows={2} defaultValue={a.gradeNote ?? ""} className="control w-full" placeholder="Motivo de la corrección" aria-label="Motivo" />
                </CertActionForm>
              </div>
            </details>
          )}
          {isAdmin && !a.passed && (a.attemptsUsed > 0 || a.inProgress) && (
            <details>
              <summary className="btn btn-outline btn-sm cursor-pointer">Restablecer intentos</summary>
              <div className="mt-2 w-64">
                <CertActionForm action={resetAttemptsAction} submitLabel="Restablecer" confirm="Se anularán los intentos suspendidos de este alumno. ¿Continuar?">
                  <input type="hidden" name="quizId" value={a.quizId} />
                  <input type="hidden" name="userId" value={a.userId} />
                  <textarea name="reason" required minLength={5} maxLength={500} rows={2} className="control w-full" placeholder="Motivo (p. ej. se cayó la conexión)" aria-label="Motivo" />
                </CertActionForm>
              </div>
            </details>
          )}
        </span>
      </td>
    </tr>
  );
}

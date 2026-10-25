import type { Metadata } from "next";
import { getJob, listJobs, type JobsOverview, type JobView } from "@/lib/jobs-api";
import { RunJobButton } from "./RunJobButton";
// [Página Admin Trabajos · Sprint 7.18 · RF-81]: estado de las colas Bull, trabajos programados (cron) y últimos trabajos; ?job=<id> abre el detalle | [Patrón]: Container (RSC) + URL State (fila seleccionada en la URL) | [Principio]: SRP + DRY (lib/jobs-api) | [Paradigma]: Declarativo + asíncrono
// [A11y]: tablas con <caption> y <th scope> · estados en texto · [Responsive]: tablas con desplazamiento horizontal en móvil · [Seguridad]: NestJS exige ADMIN (sin rol → error visible)

export const metadata: Metadata = { title: "Tareas automáticas", description: "Colas y tareas programadas (ADMIN).", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic"; // Siempre datos en vivo de Redis

const date = (ms: number | null) => (ms ? new Date(ms).toLocaleString("es-CO") : "—");
const STATUS: Record<JobView["status"], string> = { completed: "Completado", failed: "Fallido", active: "En curso", waiting: "En cola", delayed: "Programado" } // [2026-10-23]: sin emojis (texto del estado);

export default async function AdminJobsPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await props.searchParams;
  const jobId = typeof sp.job === "string" ? sp.job : undefined;
  // `Promise.allSettled` (ES2020): el detalle puede fallar (trabajo ya purgado) sin romper el panel
  const [overview, detail] = await Promise.allSettled([listJobs(), jobId ? getJob(jobId) : Promise.resolve(null)]);
  if (overview.status === "rejected")
    return (
      <p role="alert" className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        No se pudo cargar el panel de trabajos: {overview.reason instanceof Error ? overview.reason.message : "error"}
      </p>
    );
  const data: JobsOverview = overview.value;
  const selected = detail.status === "fulfilled" ? detail.value : null;
  const th = "px-3 py-2 text-left font-semibold";
  const td = "px-3 py-2";

  return (
    <section className="w-full space-y-5 py-4" aria-labelledby="jobs-title">
      <header>
        <h1 id="jobs-title" className="text-2xl font-extrabold tracking-tight sm:text-3xl">Tareas automáticas</h1>
        <p className="mt-1 text-sm text-muted-foreground">Lo que la plataforma hace sola, sin que nadie pulse un botón: envío de correos, anclaje de certificados en Sepolia, verificación de pagos cripto, exportación de reportes y limpieza nocturna (3:00) de sesiones y enlaces vencidos. Aquí ves si alguna falló.</p>
      </header>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <caption className="sr-only">Programados</caption>
          <thead className="bg-muted/50">
            <tr><th scope="col" className={th}>Trabajo</th><th scope="col" className={th}>Cron</th><th scope="col" className={th}>Próxima ejecución</th><th scope="col" className={th}><span className="sr-only">Acciones</span></th></tr>
          </thead>
          <tbody>
            {data.scheduled.map((s) => (
              <tr key={s.name} className="border-t border-border">
                <td className={td}><span className="font-semibold">{s.name}</span><p className="text-xs text-muted-foreground">{s.description}</p></td>
                <td className={`${td} font-mono text-xs`}>{s.cron}</td>
                <td className={td}>{date(s.next)}</td>
                <td className={`${td} text-right`}><RunJobButton name={s.name} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <caption className="px-3 py-2 text-left font-bold">Colas</caption>
          <thead className="bg-muted/50">
            <tr>{["Cola", "En cola", "Activos", "Completados", "Fallidos", "Programados"].map((h) => <th key={h} scope="col" className={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {data.queues.map((q) => (
              <tr key={q.name} className="border-t border-border">
                <th scope="row" className={`${td} text-left font-mono text-xs`}>{q.name}</th>
                <td className={td}>{q.counts.waiting}</td>
                <td className={td}>{q.counts.active}</td>
                <td className={td}>{q.counts.completed}</td>
                <td className={`${td} ${q.counts.failed ? "font-bold text-destructive" : ""}`}>{q.counts.failed}</td>
                <td className={td}>{q.counts.delayed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <caption className="px-3 py-2 text-left font-bold">Últimos trabajos de mantenimiento</caption>
          <thead className="bg-muted/50">
            <tr><th scope="col" className={th}>#</th><th scope="col" className={th}>Trabajo</th><th scope="col" className={th}>Estado</th><th scope="col" className={th}>Terminó</th></tr>
          </thead>
          <tbody>
            {data.recent.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Aún no hay ejecuciones.</td></tr>}
            {data.recent.slice(0, 10).map((j) => ( // [2026-10-23 · 4.º pase]: máx. 10 filas en la tabla
              <tr key={j.id} className={`border-t border-border ${j.id === jobId ? "bg-primary/5" : ""}`}>
                <td className={td}><a className="text-primary hover:underline" href={`/admin/jobs?job=${encodeURIComponent(j.id)}`} aria-current={j.id === jobId ? "true" : undefined}>{j.id}</a></td>
                <td className={td}>{j.name}</td>
                <td className={td}>{STATUS[j.status]}</td>
                <td className={td}>{date(j.finishedOn)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <section aria-labelledby="job-detail" className="rounded-xl border border-border bg-muted/40 p-4 text-sm">
          <h2 id="job-detail" className="font-bold">Trabajo #{selected.id} · {selected.name} · {STATUS[selected.status]}</h2>
          {selected.failedReason && <p className="mt-2 text-destructive">{selected.failedReason}</p>}
          <pre className="mt-2 overflow-x-auto rounded bg-background p-3 text-xs">{JSON.stringify(selected.result, null, 2)}</pre>
        </section>
      )}
    </section>
  );
}

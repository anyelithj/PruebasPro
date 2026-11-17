"use client";
import { LoadingSpinner } from "@/components/shared/LoadingSpinner";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { ExamStatus } from "@/types/quiz";
// [ExamStatusCard · 2026-11-06]: estado del examen final de un curso o de un examen de nivel → reglas, intentos y botón Empezar/Continuar
// mientras la IA genera el examen consulta cada 8 s (aria-live anuncia el cambio) | [Patrón]: Polling + Máquina de estados | [A11y]: todo en texto, no solo color

const POLL_MS = 8000;

export function ExamStatusCard({ endpoint, kind, playQuery = "" }: { endpoint: string; kind: "final" | "level"; playQuery?: string }) { // playQuery: «?desde=curso» → el «Volver» del examen lleva al curso
  const [status, setStatus] = useState<ExamStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const res = await fetch(endpoint, { cache: "no-store" });
        const body = (await res.json()) as ExamStatus & { message?: string };
        if (!alive) return;
        if (!res.ok) throw new Error(body.message ?? "No se pudo cargar el examen");
        setStatus(body);
        setError(null);
        if (body.state === "generating") timer = setTimeout(load, POLL_MS);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : "Error");
      }
    };
    void load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [endpoint]);

  if (error) return <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">{error}</p>;
  if (!status) return <LoadingSpinner className="min-h-40" />; // [2026-11-16]: mismo indicador de carga de toda la app

  const s = status;
  const rules = [
    `${s.questions} preguntas de opción múltiple, elegidas al azar en cada intento`,
    s.timeLimitMinutes ? `${s.timeLimitMinutes} minutos en total (el reloj sigue aunque cierres la página)` : "Sin límite de tiempo",
    `Apruebas con ${s.passScore} % o más`,
    "3 intentos · 10 min de espera entre intentos · tras 3 suspensos, 3 intentos más en 24 h",
    kind === "final" ? "Al aprobar, el certificado del curso se emite solo" : "Al aprobar, recibes el certificado de nivel",
  ];

  return (
    <section className="surface space-y-4 p-5" aria-labelledby="exam-title" aria-live="polite">
      <header className="flex flex-wrap items-center gap-2">
        {s.cefrLevel && <span className="badge bg-tone-brand-soft text-tone-brand">{s.cefrLevel}</span>}
        <h2 id="exam-title" className="title-section">{s.title}</h2>
      </header>

      {s.state === "locked" && (
        <div className="space-y-2">
          <p>{s.message}</p>
          {s.progress != null && (
            <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={s.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Avance del curso">
              <div className="h-full bg-primary" style={{ width: `${s.progress}%` }} />
            </div>
          )}
        </div>
      )}

      {s.state === "generating" && (
        <p className="flex items-center gap-2">
          <span className="size-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" aria-hidden />
          {s.message}
        </p>
      )}

      {s.state === "error" && <p role="alert" className="text-tone-danger">{s.message} Vuelve a intentarlo en unos minutos.</p>}

      {s.state === "passed" && (
        <div className="space-y-2 rounded-xl border border-success/40 bg-success/10 p-4">
          <p className="font-semibold text-success">✓ Aprobado con {s.bestPercent} %</p>
          <a className="btn btn-primary btn-sm" href="/certificados">Ver mi certificado</a>
        </div>
      )}

      {(s.state === "ready" || s.state === "wait") && (
        <>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {rules.map((r) => <li key={r}>{r}</li>)}
          </ul>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-muted p-2"><dt className="type-meta text-muted-foreground">Intentos usados</dt><dd className="text-lg font-bold">{s.attemptsUsed}</dd></div>
            <div className="rounded-xl bg-muted p-2"><dt className="type-meta text-muted-foreground">Te quedan</dt><dd className="text-lg font-bold">{s.attemptsLeft}</dd></div>
            <div className="rounded-xl bg-muted p-2"><dt className="type-meta text-muted-foreground">Mejor nota</dt><dd className="text-lg font-bold">{s.bestPercent != null ? `${s.bestPercent} %` : "—"}</dd></div>
          </dl>
          {s.state === "wait" ? (
            <p className="rounded-xl bg-muted p-3">
              Próximo intento disponible el <strong>{new Date(s.retryAt!).toLocaleString("es", { dateStyle: "long", timeStyle: "short" })}</strong>. Mientras tanto, repasa el curso y practica con los quizzes.
            </p>
          ) : (
            <Link href={`/quiz/${s.quizId}/play${playQuery}`} className="btn btn-primary btn-lg">
              {s.inProgress ? "▶ Continuar el examen" : "▶ Empezar el examen"}
            </Link>
          )}
        </>
      )}
    </section>
  );
}

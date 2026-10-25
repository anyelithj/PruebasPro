import { apiFetch } from "./api-client";
import { getCurrentAccessToken } from "./auth";
// [jobs-api · Sprint 7.18]: facade server-side hacia NestJS /admin/jobs (panel de trabajos ADMIN) | [Patrón]: Facade + Adapter | [Principio]: SRP + DRY (apiFetch + cookie httpOnly) | [Paradigma]: Funcional + asíncrono
// [Solo servidor]: lo usan la página RSC y la Server Action; el navegador nunca ve el JWT

// [Tipos]: forma mínima de ListJobsUseCase / GetJobUseCase | `interface` (TS) se borra al compilar
export interface QueueCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}
export interface JobView {
  id: string;
  name: string;
  status: "completed" | "failed" | "active" | "waiting" | "delayed";
  finishedOn: number | null;
  result: unknown;
  failedReason: string | null;
}
export interface JobsOverview {
  queues: { name: string; counts: QueueCounts }[];
  scheduled: { name: string; cron: string; description: string; next: number | null }[];
  recent: JobView[];
}

const bearer = async () => (await getCurrentAccessToken()) ?? undefined;

export async function listJobs(): Promise<JobsOverview> {
  return apiFetch<JobsOverview>("/admin/jobs", { bearer: await bearer(), cache: "no-store" });
}

export async function getJob(id: string): Promise<JobView> {
  return apiFetch<JobView>(`/admin/jobs/${encodeURIComponent(id)}`, { bearer: await bearer(), cache: "no-store" });
}

export async function runJob(name: string): Promise<{ jobId: string }> {
  return apiFetch<{ jobId: string }>(`/admin/jobs/${encodeURIComponent(name)}/run`, { method: "POST", bearer: await bearer() });
}

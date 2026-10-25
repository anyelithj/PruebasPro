import type { Metadata } from "next";
import { RememberReturn } from "@/components/shared/RememberReturn"; // [2026-10-23 · 4.º pase]: el «Volver» de los formularios regresa a esta pestaña/filtros
import Link from "next/link";
import { listUsers, listQuizzes, type AdminUser } from "@/lib/quiz-api";
import type { PaginatedQuizzes } from "@/types/quiz";
import { DeactivateUserButton } from "@/components/admin/DeactivateUserButton";
import { QuizAdminTable } from "@/components/quiz/QuizAdminTable";
import { ManagementHeader } from "@/components/portal/ManagementHeader";

export const metadata: Metadata = {
  title: "Gestión",
  description: "Panel de gestión de usuarios, exámenes, cursos y contenido (ADMIN).",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Tab = "usuarios" | "examenes";

interface SearchParams {
  tab?: string;
  page?: string;
  role?: string;
  search?: string;
  category?: string;
  difficulty?: string;
}

const ROLE_LABEL: Record<string, string> = {
  USER: "Estudiante",
  TEACHER: "Docente",
  ADMIN: "Administrador",
};

const ROLE_COLOR: Record<string, string> = {
  USER: "bg-tone-brand-soft text-tone-brand",
  TEACHER: "bg-tone-info-soft text-tone-info",
  ADMIN: "bg-tone-warning-soft text-tone-warning",
};

function buildQuery(sp: SearchParams, overrides: Record<string, string>): string {
  const merged: Record<string, string> = { ...overrides };
  for (const [k, v] of Object.entries(sp)) {
    if (v !== undefined && !(k in overrides)) merged[k] = v;
  }
  return new URLSearchParams(merged).toString();
}

export default async function AdminPanelPage(props: { searchParams: Promise<SearchParams> }) {
  const sp = await props.searchParams;
  const tab: Tab = sp.tab === "examenes" ? "examenes" : "usuarios";

  return (
    // [Semántica]: <div> y no <main> → el layout del portal ya aporta el único <main> de la página
    <div className="w-full space-y-5 py-4">
      {/* [Cabecera + pestañas comunes de Gestión]: Usuarios · Exámenes · Cursos · Contenido | [Principio]: DRY */}
      <ManagementHeader role="admin" active={tab === "usuarios" ? "users" : "exams"} />

      {tab === "usuarios" ? <UsersTab sp={sp} /> : <ExamsTab sp={sp} />}
    </div>
  );
}

async function UsersTab({ sp }: { sp: SearchParams }) {
  let data: { data: AdminUser[]; total: number; page: number; limit: number };
  let error: string | null = null;
  try {
    data = await listUsers({
      page: sp.page ? parseInt(sp.page, 10) : 1,
      limit: 10,
      role: sp.role,
      search: sp.search,
    });
  } catch (err) {
    error = err instanceof Error ? err.message : "Error cargando usuarios";
    data = { data: [], total: 0, page: 1, limit: 10 };
  }

  return (
    <section className="space-y-6">
      <RememberReturn memo="users" />
      <div className="flex items-start justify-between flex-wrap gap-4">
        <p className="text-sm text-muted-foreground">
          {data.total} usuario{data.total === 1 ? "" : "s"} registrado
          {data.total === 1 ? "" : "s"}.
        </p>
        <Link
          href="/admin/users/new"
          className="btn btn-primary"
        >
          + Crear usuario
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-3" action="/admin/users">
        <input type="hidden" name="tab" value="usuarios" />
        <div>
          <label htmlFor="search" className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
            Buscar
          </label>
          <input
            id="search"
            name="search"
            type="search"
            defaultValue={sp.search ?? ""}
            placeholder="Nombre o email"
            className="control"
          />
        </div>
        <div>
          <label htmlFor="role" className="block text-xs font-semibold uppercase text-muted-foreground mb-1">
            Rol
          </label>
          <select
            id="role"
            name="role"
            defaultValue={sp.role ?? ""}
            className="control"
          >
            <option value="">Todos</option>
            <option value="USER">Estudiante</option>
            <option value="TEACHER">Docente</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </div>
        <button
          type="submit"
          className="btn btn-primary"
        >
          Filtrar
        </button>
      </form>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <div className="rounded-xl border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-3 px-4 font-semibold">Nombre</th>
              <th className="py-3 px-4 font-semibold">Email</th>
              <th className="py-3 px-4 font-semibold">Rol</th>
              <th className="py-3 px-4 font-semibold">Estado</th>
              <th className="py-3 px-4 font-semibold">Registro</th>
              <th className="py-3 px-4 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data.data.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  Sin usuarios. Usa &quot;+ Crear usuario&quot; arriba.
                </td>
              </tr>
            ) : (
              data.data.map((u) => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="py-2 px-4">
                    {u.firstName} {u.lastName}
                  </td>
                  <td className="py-2 px-4 font-mono text-xs">{u.email}</td>
                  <td className="py-2 px-4">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        ROLE_COLOR[u.role] ?? ""
                      }`}
                    >
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="py-2 px-4">
                    {u.isActive ? (
                      <span className="text-tone-brand">Activo</span>
                    ) : (
                      <span className="text-muted-foreground">Inactivo</span>
                    )}
                  </td>
                  <td className="py-2 px-4 text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString("es-ES", {
                      year: "numeric",
                      month: "short",
                      day: "2-digit",
                    })}
                  </td>
                  <td className="py-2 px-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/users/${u.id}`} className="btn btn-outline btn-sm" aria-label={`Ver ${u.firstName} ${u.lastName}`}>
                        Ver
                      </Link>
                      <Link
                        href={`/admin/users/${u.id}/edit`}
                        className="btn btn-outline btn-sm"
                      >
                        Editar
                      </Link>
                      <DeactivateUserButton
                        userId={u.id}
                        userName={`${u.firstName} ${u.lastName}`}
                        isActive={u.isActive}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data.total > data.limit && (
        <nav className="flex items-center justify-center gap-2" aria-label="Paginación">
          {Array.from({ length: Math.ceil(data.total / data.limit) }, (_, i) => i + 1).map((p) => (
            <a
              key={p}
              href={`/admin/users?${buildQuery(sp, { tab: "usuarios", page: String(p) })}`}
              className={
                p === data.page
                  ? "btn btn-primary btn-sm min-w-9"
                  : "btn btn-outline btn-sm min-w-9"
              }
            >
              {p}
            </a>
          ))}
        </nav>
      )}
    </section>
  );
}

async function ExamsTab({ sp }: { sp: SearchParams }) {
  let data: PaginatedQuizzes;
  let error: string | null = null;
  try {
    data = await listQuizzes({
      page: sp.page ? parseInt(sp.page, 10) : 1,
      limit: 10,
      category: sp.category,
      difficulty: sp.difficulty,
    });
  } catch (err) {
    error = err instanceof Error ? err.message : "Error cargando exámenes";
    data = { data: [], total: 0, page: 1, limit: 10 };
  }

  return (
    <section className="space-y-6">
      <RememberReturn memo="exams" />
      <div className="flex items-start justify-between flex-wrap gap-4">
        <p className="text-sm text-muted-foreground">
          {data.total} {data.total === 1 ? "examen" : "exámenes"} en la plataforma.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/quiz/create"
            className="btn btn-primary"
          >
            + Crear examen
          </Link>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <QuizAdminTable quizzes={data.data} />

      {data.total > data.limit && (
        <nav className="flex items-center justify-center gap-2" aria-label="Paginación">
          {Array.from({ length: Math.ceil(data.total / data.limit) }, (_, i) => i + 1).map((p) => (
            <a
              key={p}
              href={`/admin/users?${buildQuery(sp, { tab: "examenes", page: String(p) })}`}
              className={
                p === data.page
                  ? "btn btn-primary btn-sm min-w-9"
                  : "btn btn-outline btn-sm min-w-9"
              }
            >
              {p}
            </a>
          ))}
        </nav>
      )}
    </section>
  );
}

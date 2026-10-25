import { BackLink } from "@/components/shared/BackLink"; // [2026-10-23]: enlace «volver» uniforme (icono + texto)
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/quiz-api";
import { DeactivateUserButton } from "@/components/admin/DeactivateUserButton";
// [Página /admin/users/:id]: "Ver" usuario — ficha de solo lectura con accesos a editar, historial y activar/desactivar | [Patrón]: Container (RSC) + Presentational | [Principio]: SRP | [Paradigma]: Declarativo

export const metadata: Metadata = {
  title: "Gestión · Usuario",
  robots: { index: false, follow: false }, // Privada: no indexar
};

export const dynamic = "force-dynamic"; // Depende de la sesión → render por petición

// [Etiquetas de rol]: `as const` (TS) → literales inmutables
const ROLE_LABEL = { USER: "Estudiante", TEACHER: "Docente", ADMIN: "Administrador" } as const;

export default async function UserDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await getUser(id).catch(() => notFound()); // `notFound()` (Next.js): 404 si no existe o no hay permiso
  const name = `${user.firstName} ${user.lastName}`;
  // `Intl.DateTimeFormat` vía toLocaleDateString (ECMA-402): fecha legible sin librerías
  const created = new Date(user.createdAt).toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "2-digit" });

  // [Ficha]: pares etiqueta/valor → <dl> semántico (lectores de pantalla anuncian la relación) | [Patrón]: Data-driven rendering
  const rows: ReadonlyArray<[string, ReactNode]> = [
    ["Email", <span key="e" className="font-mono text-xs">{user.email}</span>],
    ["Rol", ROLE_LABEL[user.role]],
    ...(user.role === "USER" ? [["Sección", user.section || "—"] as [string, ReactNode]] : []), // Spread condicional: solo estudiantes tienen sección
    ["Estado", user.isActive ? <span key="s" className="text-tone-brand">Activo</span> : <span key="s" className="text-muted-foreground">Inactivo</span>],
    ["Email verificado", user.isEmailVerified ? "Sí" : "No"],
    ["Registro", created],
  ];

  return (
    <div className="w-full space-y-5 py-4">
      <BackLink href="/admin/users" memo="users">Volver a usuarios</BackLink>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* [Avatar de iniciales]: decorativo → aria-hidden */}
          <span aria-hidden className="grid size-12 place-items-center rounded-full bg-gradient-brand text-lg font-bold text-white">
            {user.firstName.charAt(0)}
            {user.lastName.charAt(0)}
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{name}</h1>
            <p className="text-sm text-muted-foreground">{ROLE_LABEL[user.role]}</p>
          </div>
        </div>
      </header>

      <dl className="surface divide-y divide-border">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[140px_1fr] gap-3 px-5 py-3 text-sm">
            <dt className="font-semibold text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap gap-2">
        <Link href={`/admin/users/${user.id}/edit`} className="btn btn-primary">
          Editar
        </Link>
        {user.role === "USER" && (
          <Link href={`/teacher/students/${user.id}/history`} className="btn btn-outline">
            Ver historial de exámenes
          </Link>
        )}
        <DeactivateUserButton userId={user.id} userName={name} isActive={user.isActive} />
      </div>
    </div>
  );
}

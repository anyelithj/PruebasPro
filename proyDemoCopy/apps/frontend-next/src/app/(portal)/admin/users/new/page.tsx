import { BackLink } from "@/components/shared/BackLink"; // [2026-10-23]: enlace «volver» uniforme (icono + texto)
import type { Metadata } from "next";
import { UserForm } from "../UserForm"; // [Formulario único]: el mismo que usa la edición
// [Página crear usuario admin]: cabecera + formulario compartido | [Patrón]: Container (RSC) + Presentational | [Principio]: SRP + DRY

export const metadata: Metadata = {
  title: "Gestión · Crear usuario",
  robots: { index: false, follow: false }, // Privada: no indexar
};

export default function NewUserPage() {
  return (
    // [Semántica]: <div> (el layout del portal ya aporta el <main>)
    <div className="w-full space-y-5 py-4">
      <BackLink href="/admin/users" memo="users">Volver a usuarios</BackLink>
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Crear usuario</h1>
          <p className="mt-1 text-sm text-muted-foreground">Alta directa de usuario por administrador.</p>
        </div>
      </header>
      <UserForm />
    </div>
  );
}

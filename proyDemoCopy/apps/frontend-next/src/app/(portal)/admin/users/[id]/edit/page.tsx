import { BackLink } from "@/components/shared/BackLink"; // [2026-10-23]: enlace «volver» uniforme (icono + texto)
import { notFound } from "next/navigation";
import { getUser } from "@/lib/quiz-api";
import { UserForm } from "../../UserForm"; // [Formulario único]: el mismo del alta, con `initial`
// [Página editar usuario admin]: SSR fetch + formulario compartido | [Patrón]: Container + Presentational | [Principio]: DRY

export const dynamic = "force-dynamic";

export default async function EditUserPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  let user;
  try {
    user = await getUser(id);
  } catch {
    notFound();
  }

  return (
    <div className="w-full space-y-5 py-4">
      <BackLink href="/admin/users" memo="users">Volver a usuarios</BackLink>
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Editar usuario</h1>
          <p className="mt-1 text-sm text-muted-foreground font-mono">{user.email}</p>
        </div>
      </header>

      <UserForm initial={{ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, section: user.section, phone: user.phone }} />
    </div>
  );
}

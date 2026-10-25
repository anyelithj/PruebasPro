import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth";
import { Role, AUTH_ROUTES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const role = await getCurrentUserRole();
  if (!role) redirect(`${AUTH_ROUTES.login}?from=/dashboard`);
  switch (role) {
    case Role.ADMIN:
      redirect("/dashboard/admin");
    case Role.TEACHER:
      redirect("/dashboard/docente");
    case Role.USER:
    default:
      redirect("/dashboard/estudiante");
  }
}

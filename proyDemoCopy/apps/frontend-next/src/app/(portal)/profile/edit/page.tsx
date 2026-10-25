import type { Metadata } from "next"; // [Next.js]: tipo de la Metadata API (SEO) | `import type` (TS): se borra al compilar
import Link from "next/link"; // [Next.js]: navegación cliente con prefetch
import { redirect } from "next/navigation"; // [Next.js]: redirección server-side (lanza y corta el render)
import { getMyProfile, type ProfileData } from "@/lib/profile-api"; // [Facade]: GET /profile/me con cookie httpOnly
import { getServerDictionary } from "@/lib/i18n-server";
import { toPortalRole } from "@/components/portal/portal-role";
import { ProfileEditForm } from "./ProfileEditForm"; // [Presentational]: tarjeta de datos personales
import { AvatarCard } from "./AvatarCard"; // [Presentational]: tarjeta del avatar
import { ChangePasswordForm } from "./ChangePasswordForm"; // [Presentational]: cambio de contraseña (2026-10-23)
// [Página /profile/edit]: "Mi Perfil" de NeuroLearning — datos personales (izq.) + avatar (der.) | [Patrón]: Container/Presentational | [Principio]: SRP | [Paradigma]: RSC + Server Fetch

// `export const metadata` (Next.js): título/descr. para la pestaña; noindex porque es privada | [SEO]
export const metadata: Metadata = {
  title: "Mi perfil",
  description: "Datos personales y personalización del avatar.",
  robots: { index: false, follow: false },
};

// `export const dynamic` (Next.js): render por petición, depende de la sesión del usuario
export const dynamic = "force-dynamic";

// `export default async function` (React Server Component): corre en el servidor y puede usar await
export default async function ProfileEditPage() {
  let profile: ProfileData; // `let` (ES2015): se asigna dentro del try
  try {
    profile = await getMyProfile(); // `await` (ES2017): espera la respuesta del backend NestJS
  } catch {
    redirect("/login?from=/profile/edit"); // [Fail-safe]: sesión inválida → login y volver aquí
  }
  const t = await getServerDictionary();
  const roleLabel = t.roles[toPortalRole(profile.role)]; // USER/TEACHER/ADMIN → "Estudiante"/"Docente"/…

  return (
    // [Semántica]: <section> (el <main> ya lo pone el layout del portal) | fade-in: animación de entrada del original
    <section className="fade-in w-full space-y-5 py-4" aria-labelledby="profile-title">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 id="profile-title" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {t.profile.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.profile.intro}</p>
        </div>
        <Link
          href="/profile"
          className="btn btn-outline self-start"
        >
          {t.profile.viewProgress}
        </Link>
      </header>

      {/* [Responsive]: 1 columna en móvil/tablet, 2 columnas desde lg (igual al original) */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <ProfileEditForm
          firstName={profile.firstName}
          lastName={profile.lastName}
          email={profile.email}
          roleLabel={roleLabel}
          section={profile.section}
          phone={profile.phone}
          isStudent={profile.role === "USER"} // [Regla de negocio]: sección, cursos y nivel solo aplican a estudiantes
          bio={profile.bio}
          timezone={profile.timezone}
          preferredLanguage={profile.preferredLanguage}
          enrolledCourses={profile.enrolledCourses}
          level={profile.level}
        />
        <AvatarCard storageKey={`profile-avatar:${profile.id}`} badge={roleLabel} />
        {/* [2026-10-24]: «Cambiar contraseña» ocupa el 100 % del contenedor (las dos columnas) en vez de quedar bajo el avatar */}
        <div className="lg:col-span-2">
          <ChangePasswordForm />
        </div>
      </div>
    </section>
  );
}

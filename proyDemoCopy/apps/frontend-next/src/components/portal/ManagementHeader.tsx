import Link from "next/link"; // [Next.js]: navegación cliente con prefetch; las pestañas son enlaces reales (funcionan sin JS)
import { FileText, Gamepad2, Library, NotebookText, Users, type LucideIcon } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (mismo set que el menú lateral)
import { cn } from "@/lib/utils";
import { getServerDictionary } from "@/lib/i18n-server";
import type { PortalRole } from "./portal-role";
// [ManagementHeader]: título + pestañas de la sección Gestión (usuarios, exámenes, cursos, contenido) | [Patrón]: Template (cabecera común) + Lookup Table por rol | [Principio]: DRY (antes cada página tenía su propio header) + OCP
// [Tecnología]: React Server Component asíncrono → lee el idioma en el servidor, sin JavaScript en el cliente

// `export type` (TS union literal): pestañas posibles de Gestión
export type ManagementTab = "users" | "exams" | "courses" | "content" | "activities";

// [TAB_ICON · 2026-10-23]: un icono por pestaña (antes solo texto) | `Readonly<Record<…>>` (TS)
const TAB_ICON: Readonly<Record<ManagementTab, LucideIcon>> = { users: Users, exams: FileText, courses: Library, content: NotebookText, activities: Gamepad2 };

interface TabDef {
  key: ManagementTab; // Clave de traducción y de pestaña activa
  href: string; // Ruta de la pestaña (URL state → compartible y navegable con atrás/adelante)
}

// [Pestañas por rol]: el docente no gestiona usuarios ni cursos (el backend exige ADMIN) | `ReadonlyArray` (TS): inmutable
const TABS_BY_ROLE: Readonly<Record<"admin" | "docente", ReadonlyArray<TabDef>>> = {
  admin: [
    { key: "users", href: "/admin/users?tab=usuarios" },
    { key: "exams", href: "/admin/users?tab=examenes" },
    { key: "courses", href: "/admin/courses" },
    { key: "content", href: "/admin/curriculum" },
    { key: "activities", href: "/admin/activities" }, // [2026-10-19]: administrar juegos, práctica, música, diálogos y poliglota
  ],
  docente: [
    { key: "exams", href: "/teacher/quizzes" },
    { key: "content", href: "/admin/curriculum" },
    { key: "activities", href: "/admin/activities" },
  ],
};

// `export async function` (RSC): puede usar await para obtener el diccionario
export async function ManagementHeader({ role, active }: { role: PortalRole; active: ManagementTab }) {
  const t = await getServerDictionary();
  const isAdmin = role === "admin"; // Estudiante nunca llega aquí por navegación; si llega, ve las pestañas de docente y el backend lo frena
  const tabs = TABS_BY_ROLE[isAdmin ? "admin" : "docente"];

  return (
    <>
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t.management.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAdmin ? t.management.subtitleAdmin : t.management.subtitleTeacher}
        </p>
      </header>

      {/* [Pestañas]: <nav> + aria-current → el lector de pantalla anuncia la pestaña activa | [2026-10-23]: flex-wrap (sin barra de desplazamiento) → en móvil bajan de línea */}
      <nav className="flex flex-wrap gap-1 border-b border-border" aria-label={t.management.tabsLabel}>
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          const Icon = TAB_ICON[tab.key];
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-semibold transition-colors",
                isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon aria-hidden className="size-4" />
              {t.management.tabs[tab.key]}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

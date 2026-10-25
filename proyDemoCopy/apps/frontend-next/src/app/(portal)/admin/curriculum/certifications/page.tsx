import { BackLink } from "@/components/shared/BackLink"; // [2026-10-23]: enlace «volver» uniforme (icono + texto)
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listCertifications } from "@/lib/curriculum-api";
import { getCurrentUserPayload } from "@/lib/auth";
import { Role } from "@/lib/constants";
import { LANGUAGES, languageLabel } from "@/lib/languages";
import { SKILL_LABEL } from "@/types/curriculum";
import { CertificationPracticePanel } from "@/components/curriculum/CertificationPracticePanel";
// [Página /admin/curriculum/certifications · Etapa 5]: catálogo de certificaciones (especificaciones públicas) + generador de práctica original | [Patrón]: Container (RSC) + panel cliente | [Principio]: SRP | [Seguridad]: docente o admin

export const metadata: Metadata = { title: "Gestión · Exámenes oficiales", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ language?: string }> };

export default async function CertificationsPage(props: PageProps) {
  const user = await getCurrentUserPayload();
  if (user?.role !== Role.ADMIN && user?.role !== Role.TEACHER) notFound();
  const { language } = await props.searchParams;
  const certs = await listCertifications(language);

  return (
    <div className="w-full space-y-5 py-4">
      <BackLink href="/admin/curriculum" memo="content">Volver a recursos</BackLink>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Exámenes oficiales</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Exámenes oficiales por idioma según sus especificaciones públicas. La plataforma prepara con ítems <b>originales</b>: nunca reproduce preguntas de
            exámenes oficiales y no es un centro examinador.
          </p>
        </div>
      </header>

      {/* [Filtro por idioma]: chips con aria-current (navegables sin JS) */}
      <nav aria-label="Idioma" className="flex flex-wrap gap-1.5">
        <Link href="/admin/curriculum/certifications" aria-current={!language ? "page" : undefined} className="chip">
          Todos
        </Link>
        {LANGUAGES.map((l) => (
          <Link key={l.value} href={`/admin/curriculum/certifications?language=${l.value}`} aria-current={language === l.value ? "page" : undefined} className="chip">
            {l.label}
          </Link>
        ))}
      </nav>

      {/* [Catálogo]: una tarjeta por certificación | grid responsive 1 → 2 → 3 columnas */}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {certs.map((c) => (
          <li key={c.id} className="surface flex flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold">{c.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {languageLabel(c.language)} · {c.issuer}
                </p>
              </div>
              {/* El significado está en el texto (no solo en el color) */}
              <span className={`badge shrink-0 ${c.cefrMapping === "official" ? "bg-tone-brand-soft text-tone-brand" : "bg-tone-warning-soft text-tone-warning"}`}>
                MCER {c.cefrMapping === "official" ? "oficial" : "orientativo"}
              </span>
            </div>
            <ul className="flex flex-wrap gap-1 text-xs" aria-label="Niveles">
              {c.levels.map((l) => (
                <li key={l.cefr} className="rounded-md border border-border px-2 py-0.5">
                  <b>{l.cefr}</b> · {l.exam}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">Evalúa: {c.skills.map((s) => SKILL_LABEL[s]).join(", ")}</p>
            {c.url ? (
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="mt-auto text-xs font-semibold text-primary hover:underline">
                Especificaciones oficiales ↗<span className="sr-only"> (se abre en otra pestaña)</span>
              </a>
            ) : (
              <p className="mt-auto text-xs text-muted-foreground">Consultar las especificaciones con el centro examinador.</p>
            )}
          </li>
        ))}
      </ul>

      <CertificationPracticePanel certifications={certs} />
    </div>
  );
}

"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";
import type { LanguageGroup } from "@/types/courses";
import { usePreferences } from "@/components/layout/PreferencesProvider";
import { LanguageChips } from "@/components/shared/LanguageChips"; // [2026-10-27]: mismas pestañas de idioma en toda la app
// [crf · CourseFilter]: tabpills del catálogo = un chip por idioma | [Patrón]: URL State + Container | [Principio]: SRP

// [Chip = idioma]: cada chip mapea 1↔1 con CourseGroup del backend | [Principio]: SSOT
export type CourseChip = LanguageGroup;

export interface CourseFilterProps {
  // [activeChip]: pasado por server (page.tsx leyó URL params) | [Principio]: SSOT
  activeChip: CourseChip | "ALL";
  initialSearch?: string;
}

export function CourseFilter({ activeChip, initialSearch = "" }: CourseFilterProps) {
  const router = useRouter();
  const { t } = usePreferences(); // [i18n]: textos del filtro en el idioma activo
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  // [hrefWith · 2026-10-27]: URL con los cambios aplicados (sin página → vuelve a la 1) | la usan la búsqueda (router.push) y los chips (<Link>) | [Principio]: DRY
  const hrefWith = useCallback(
    (next: Record<string, string | null>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v === null || v === "") sp.delete(k);
        else sp.set(k, v);
      }
      sp.delete("page");
      return `${pathname}?${sp.toString()}`;
    },
    [pathname, params],
  );
  const updateParam = (next: Record<string, string | null>) => startTransition(() => router.push(hrefWith(next)));

  const onSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = (formData.get("q") as string | null) ?? "";
    updateParam({ search: q || null });
  };

  return (
    <section
      aria-label={t.courses.filtersLabel}
      className="rounded-xl p-4 mb-5 flex flex-col gap-3"
      style={{ background: "var(--nl-surf)", border: "1px solid var(--nl-brd)" }}
    >
      {/* Búsqueda */}
      <form onSubmit={onSearch} role="search" className="flex gap-2 w-full">
        <label htmlFor="course-search" className="sr-only">
          {t.courses.searchLabel}
        </label>
        <input
          id="course-search"
          name="q"
          type="search"
          defaultValue={initialSearch}
          placeholder={t.courses.searchPlaceholder}
          className="control min-w-0 flex-1" // [Sistema de diseño]: mismo campo que el resto de buscadores
        />
        <button
          type="submit"
          className="btn btn-primary"
        >
          {t.courses.search}
        </button>
      </form>

      {/* Tabpills */}
      {/* [2026-10-27]: chips de idioma extraídos a <LanguageChips> (DRY) → Recursos, Exámenes y Actividades clasifican igual que este catálogo | cada chip es un <Link> (navegable sin JS) */}
      <LanguageChips
        active={activeChip === "ALL" ? undefined : activeChip}
        hrefFor={(lang) => hrefWith({ chip: lang ? lang.toUpperCase() : null })} // El chip del curso es el grupo en mayúscula ("FR")
        names={t.languageNames}
        allLabel={t.courses.all}
        label={t.courses.languagesLabel}
      />
    </section>
  );
}

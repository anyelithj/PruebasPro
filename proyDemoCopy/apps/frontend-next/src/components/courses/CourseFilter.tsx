"use client";

import { Sparkles } from "lucide-react"; // [2026-10-23]: iconos SVG uniformes (antes emojis)
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";
import {
  LANGUAGE_GROUPS,
  type LanguageGroup,
} from "@/types/courses";
import { usePreferences } from "@/components/layout/PreferencesProvider";
// [crf · CourseFilter]: tabpills del catálogo = un chip por idioma | [Patrón]: URL State + Container | [Principio]: SRP

// [Chip = idioma]: cada chip mapea 1↔1 con CourseGroup del backend | [Principio]: SSOT
export type CourseChip = LanguageGroup;

// [Chips derivados del SSOT de idiomas]: sin listas duplicadas | la etiqueta se traduce en render | [Principio]: DRY
const CHIPS: ReadonlyArray<{ value: CourseChip }> = LANGUAGE_GROUPS.map((g) => ({ value: g }));

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

  const updateParam = useCallback(
    (next: Record<string, string | null>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v === null || v === "") sp.delete(k);
        else sp.set(k, v);
      }
      sp.delete("page");
      startTransition(() => router.push(`${pathname}?${sp.toString()}`));
    },
    [router, pathname, params],
  );

  const onChipClick = (value: CourseChip) => {
    if (activeChip === value) {
      updateParam({ chip: null });
    } else {
      updateParam({ chip: value });
    }
  };

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
      <div className="flex gap-1.5 flex-wrap" role="group" aria-label={t.courses.languagesLabel}>
        {/* [Chip "Todos"]: igual al original; activo con el degradado morado de marca */}
        <button
          type="button"
          aria-pressed={activeChip === "ALL"}
          onClick={() => updateParam({ chip: null })}
          className="chip" // [Utilidad chip]: aria-pressed="true" lo pinta con el degradado de marca
        >
          <Sparkles aria-hidden className="inline size-4 align-[-0.125em]" /> {t.courses.all}
        </button>
        {CHIPS.map((chip) => {
          const isActive = activeChip === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChipClick(chip.value)}
              className="chip" // Todos los chips iguales: activo = degradado morado (uniformidad en toda la app)
            >
              <span aria-hidden className="font-mono">{chip.value}</span> {t.languageNames[chip.value] ?? chip.value}
            </button>
          );
        })}
      </div>
    </section>
  );
}

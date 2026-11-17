import { FilterPanel } from "@/components/admin/FilterPanel"; // [2026-11-11]: panel común («Limpiar» que sí limpia)
import { LanguageChips } from "@/components/shared/LanguageChips";
import { CATEGORIES } from "@/lib/categories";
// [QuizFilters · 2026-10-31]: panel de filtros de Gestión → Exámenes, igual que Cursos, Recursos y Actividades (buscar · nivel · habilidad · estado + pestañas de idioma) | antes solo lo tenía el docente; el ADMIN no veía ninguno
// [Patrón]: Presentational (Server Component sin estado) + URL State | [Principio]: DRY + SRP | [Paradigma]: Declarativo | [A11y]: <section>/<form> con nombre y etiquetas visibles | formulario GET nativo: URL compartible, funciona sin JS

export interface QuizFilterParams {
  search?: string;
  difficulty?: string;
  category?: string;
  status?: string;
  language?: string;
  tab?: string; // Admin: pestaña «examenes» de /admin/users
}

const DIFFICULTIES = [{ value: "easy", label: "Fácil" }, { value: "medium", label: "Media" }, { value: "hard", label: "Difícil" }]; // Valores del enum Difficulty de NestJS | [Patrón]: Lookup Table
const STATUSES = [{ value: "published", label: "Publicado" }, { value: "draft", label: "Borrador" }];

export function QuizFilters({ sp, pathname, activeLanguage }: { sp: QuizFilterParams; pathname: string; activeLanguage?: string }) {
  // [hrefFor]: conserva los filtros y vuelve a la página 1 | `Object.fromEntries` (ES2019): sin claves vacías → URL limpia
  const query = (patch: Partial<QuizFilterParams>) =>
    Object.fromEntries(Object.entries({ search: sp.search, difficulty: sp.difficulty, category: sp.category, status: sp.status, tab: sp.tab, ...patch }).filter(([, v]) => v)) as Record<string, string>;
  return (
    <FilterPanel
      label="Filtros de exámenes"
      clearHref={{ pathname, query: sp.tab ? { tab: sp.tab } : {} }}
      hidden={{ tab: sp.tab, language: activeLanguage }}
      search={{ value: sp.search, placeholder: "Tema o palabra clave…" }}
      // «Nivel» = dificultad (el examen no guarda nivel MCER) · «Habilidad» = categoría
      selects={[
        { name: "difficulty", label: "Nivel", value: sp.difficulty, all: "Todos", options: DIFFICULTIES },
        { name: "category", label: "Habilidad", value: sp.category, all: "Todas", options: CATEGORIES.map((c) => ({ value: c.value, label: c.label })) },
        { name: "status", label: "Estado", value: sp.status, all: "Todos", options: STATUSES },
      ]}
      chips={<LanguageChips active={activeLanguage} hrefFor={(language) => ({ pathname, query: query({ language }) })} allLabel="Todos" label="Idioma" />}
    />
  );
}

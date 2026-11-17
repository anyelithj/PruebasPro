import { Library, Lock, NotebookPen, Timer, Award } from "lucide-react";
import { RememberReturn } from "@/components/shared/RememberReturn"; // [2026-10-23 · 4.º pase]: el «Volver» de los formularios regresa a esta pestaña/filtros
import type { Metadata } from "next";
import Link from "next/link";
import { listQuizzes, getMySessionsHistory, getExamCatalog } from "@/lib/quiz-api";
import type { ExamCatalogItem } from "@/types/quiz";
import { LANGUAGES, LEVEL_OPTIONS, languageLabel, isLanguage } from "@/lib/languages";
import { totalMinutes } from "@/components/portal/quiz-format";

export const metadata: Metadata = {
  title: "Exámenes",
  description: "Exámenes finales de curso, de nivel y de práctica.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

interface SearchParams {
  page?: string;
  q?: string; // [2026-11-09]: búsqueda por título / curso
  language?: string;
  level?: string;
  kind?: string; // final | nivel | practica (vacío = todos)
}

// [KINDS · 2026-11-09]: el mismo texto sirve de opción del filtro y de etiqueta de la tarjeta
const KINDS = { final: "Final de curso", nivel: "Examen Nivel", practica: "Práctica" } as const;
type Kind = keyof typeof KINDS;
const KIND_STYLE: Record<Kind, string> = {
  final: "bg-tone-brand-soft text-tone-brand",
  nivel: "bg-tone-info-soft text-tone-info",
  practica: "bg-muted text-muted-foreground",
};
const PER_PAGE = 12;

// [ExamItem · 2026-11-09]: forma común de las tres clases de examen → una sola tarjeta para todas
interface ExamItem {
  key: string;
  kind: Kind;
  title: string;
  language: string | null;
  level: string | null;
  questions: number;
  minutes: number;
  certificate: boolean;
  locked: boolean;
  lockText?: string;
  progress?: number | null;
  status?: string; // «✓ Aprobado», «Completado · 80 %»…
  href: string;
  cta: string;
}

const fromCatalog = (e: ExamCatalogItem): ExamItem => ({
  key: e.quizId ?? `final:${e.courseId}`,
  kind: "final",
  title: e.courseTitle ?? e.title,
  language: e.language,
  level: e.cefrLevel,
  questions: e.questions,
  minutes: e.timeLimitMinutes,
  certificate: true,
  locked: e.locked,
  lockText: e.enrolled ? `Termina el curso al 100 % para desbloquearlo (vas en ${e.progress ?? 0} %).` : "Inscríbete en el curso y termínalo al 100 % para desbloquearlo.",
  progress: e.enrolled ? e.progress : null,
  status: e.passed ? "✓ Aprobado" : undefined,
  href: e.locked ? `/courses/${e.courseId}` : `/quiz/examen/curso/${e.courseId}`,
  cta: e.locked ? "Ir al curso" : e.passed ? "Ver resultado" : "Presentar examen",
});

export default async function QuizListPage(props: { searchParams: Promise<SearchParams> }) {
  const sp = await props.searchParams;
  const language = isLanguage(sp.language) ? sp.language : "";
  const level = LEVEL_OPTIONS.some((l) => l.value === sp.level) ? sp.level! : "";
  const kind = (sp.kind && sp.kind in KINDS ? sp.kind : "") as Kind | "";
  const q = (sp.q ?? "").trim();

  // ponytail: práctica limitada a 50 (tope del backend); paginar en servidor si algún día hay más
  const [catalog, practice, sessions] = await Promise.all([
    getExamCatalog().catch(() => [] as ExamCatalogItem[]),
    listQuizzes({ limit: 50, language: language || undefined, search: q || undefined }).catch(() => null),
    getMySessionsHistory(100).catch(() => []),
  ]);

  const best: Record<string, number> = {};
  for (const s of sessions) if (s.status === "completed") best[s.quizId] = Math.max(best[s.quizId] ?? 0, Math.round(s.accuracy * 100));

  // [Nivel]: uno por idioma × nivel MCER (la IA lo genera al abrirlo); si ya existe, su estado sale del catálogo
  const levelDone = new Map(catalog.filter((e) => e.kind === "level").map((e) => [`${e.language}:${e.cefrLevel}`, e]));
  const levelItems: ExamItem[] = LANGUAGES.flatMap((l) =>
    LEVEL_OPTIONS.map((lv): ExamItem => {
      const e = levelDone.get(`${l.value}:${lv.value}`);
      return {
        key: `level:${l.value}:${lv.value}`,
        kind: "nivel",
        title: `Examen de nivel · ${l.label} ${lv.value}`,
        language: l.value,
        level: lv.value,
        questions: e?.questions ?? catalog[0]?.questions ?? 20,
        minutes: e?.timeLimitMinutes ?? 0,
        certificate: true,
        locked: false,
        status: e?.passed ? "✓ Aprobado" : undefined,
        href: `/quiz/examen/nivel?language=${l.value}&level=${lv.value}`,
        cta: e?.passed ? "Ver resultado" : "Presentar examen",
      };
    }),
  );
  const practiceItems: ExamItem[] = (practice?.data ?? []).map((p) => ({
    key: p.id,
    kind: "practica",
    title: p.title,
    language: p.language ?? null,
    level: null,
    questions: p.questionsCount,
    minutes: totalMinutes(p.timePerQuestionSeconds, p.questionsCount || 1),
    certificate: false,
    locked: false,
    status: best[p.id] !== undefined ? `Completado · ${best[p.id]} %` : undefined,
    href: `/quiz/${p.id}/play`, // [Fix 2026-11-11]: practicar = presentar el examen; /quiz/:id es la vista de Gestión (borrador · editar · publicar)
    cta: best[p.id] !== undefined ? "Repetir" : "Iniciar examen",
  }));

  const needle = q.toLowerCase();
  const items = [...catalog.filter((e) => e.kind === "final").map(fromCatalog), ...levelItems, ...practiceItems].filter(
    (i) =>
      (!kind || i.kind === kind) &&
      (!language || i.language === language) &&
      (!level || i.level === level) &&
      (!needle || i.title.toLowerCase().includes(needle)),
  );
  const pages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, parseInt(sp.page ?? "1", 10) || 1));
  const shown = items.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const pageHref = (p: number) => ({ pathname: "/quiz", query: Object.fromEntries(Object.entries({ ...sp, page: String(p) }).filter(([, v]) => v)) as Record<string, string> });

  return (
    <div className="w-full space-y-5 py-4">
      <RememberReturn memo="exams" />
      <header>
        <h1 className="title-page">Exámenes</h1>
        <p className="mt-1 text-muted-foreground">
          Los exámenes <b>Final de curso</b> y <b>Examen Nivel</b> dan certificado; los de <b>Práctica</b> son para entrenar. {items.length} {items.length === 1 ? "examen" : "exámenes"}.
        </p>
      </header>

      {/* [Filtros · 2026-11-09]: formulario GET nativo → la URL guarda la búsqueda y funciona sin JS */}
      <form key={`${q}|${kind}|${language}|${level}`} method="get" action="/quiz" role="search" className="surface grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end">
        <label className="text-sm font-semibold">
          Buscar
          <input type="search" name="q" defaultValue={q} placeholder="Título del examen o del curso" className="control mt-1 block w-full" />
        </label>
        <label className="text-sm font-semibold">
          Tipo
          <select name="kind" defaultValue={kind} className="control mt-1 block w-full">
            <option value="">Todos</option>
            {(Object.keys(KINDS) as Kind[]).map((k) => <option key={k} value={k}>{KINDS[k]}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Idioma
          <select name="language" defaultValue={language} className="control mt-1 block w-full">
            <option value="">Todos</option>
            {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Nivel
          <select name="level" defaultValue={level} className="control mt-1 block w-full">
            <option value="">Todos</option>
            {LEVEL_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </label>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary">Filtrar</button>
          {(q || kind || language || level) && <a href="/quiz" className="btn btn-ghost">Limpiar</a>}
        </div>
      </form>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center space-y-3">
          <Library aria-hidden className="mx-auto size-10 text-tone-brand" />
          <h2 className="title-section">No hay exámenes con estos filtros</h2>
          <p className="text-muted-foreground">Prueba con otra búsqueda, idioma o tipo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((i) => (
            <article key={i.key} className={`flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-lg ${i.locked ? "opacity-80" : ""}`}>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`badge ${KIND_STYLE[i.kind]}`}>{KINDS[i.kind]}</span>
                {i.certificate && <span className="badge bg-tone-success-soft text-tone-success"><Award aria-hidden className="inline size-3.5" /> Certificado</span>}
                {i.level && <span className="badge bg-muted">{i.level}</span>}
                {i.locked ? (
                  <span className="badge ml-auto bg-muted text-muted-foreground"><Lock aria-hidden className="inline size-3.5" /> Bloqueado</span>
                ) : i.status ? (
                  <span className="badge ml-auto bg-tone-success-soft text-tone-success">{i.status}</span>
                ) : null}
              </div>
              <h3 className="title-card">{i.title}</h3>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {i.language && <span><span className="font-mono font-bold">{i.language.toUpperCase()}</span> {languageLabel(i.language)}</span>}
                <span><NotebookPen aria-hidden className="inline size-4 align-[-0.125em]" /> {i.questions} preguntas</span>
                {i.minutes > 0 && <span><Timer aria-hidden className="inline size-4 align-[-0.125em]" /> {i.minutes} min</span>}
              </p>
              {i.locked && (
                <>
                  <p className="text-sm">{i.lockText}</p>
                  {i.progress != null && (
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={i.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Avance del curso">
                      <div className="h-full bg-primary" style={{ width: `${i.progress}%` }} />
                    </div>
                  )}
                </>
              )}
              <div className="mt-auto flex justify-end border-t border-border pt-3">
                <Link href={i.href} className="btn btn-primary btn-sm">{i.cta} →</Link>
              </div>
            </article>
          ))}
        </div>
      )}

      {pages > 1 && (
        <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Paginación">
          {Array.from({ length: pages }, (_, n) => n + 1).map((p) => (
            <Link key={p} href={pageHref(p)} aria-current={p === page ? "page" : undefined} className={p === page ? "btn btn-primary btn-sm min-w-9" : "btn btn-outline btn-sm min-w-9"}>
              {p}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}

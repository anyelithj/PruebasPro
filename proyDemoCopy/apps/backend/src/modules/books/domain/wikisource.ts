import type { BookGenre } from './book';
// [Wikisource · Dominio · Libros · 2026-11-17]: reglas puras para leer Wikisource (textos de dominio público en el idioma ORIGINAL, con géneros por categorías)
// [Patrón]: Lookup Table + Pure Functions | [Paradigma]: Funcional (sin E/S) | [Por qué]: Gutendex casi solo tiene inglés y no tiene géneros

export const WIKISOURCE_ATTRIBUTION =
  'Texto de Wikisource (wikisource.org), dominio público.';

// [WIKISOURCE_GENRES]: género → categorías de cada Wikisource · VERIFICADAS el 2026-11-17 con prop=categoryinfo (n.º de páginas entre paréntesis)
// Solo categorías con obras suficientes; lo que falta (p. ej. casi todo pt y zh) lo cubre Gutendex (BooksCatalogAdapter)
export const WIKISOURCE_GENRES: Readonly<
  Record<string, Partial<Record<BookGenre, readonly string[]>>>
> = {
  es: {
    novel: ['Novelas'], // 428
    tale: ['Cuentos'], // 1356
    poetry: ['Poesías'], // 5330
    drama: ['Comedias', 'Dramas'], // 50 + 23
    fable: ['Fábulas'], // 769
    essay: ['Ensayos'], // 476
    legend: ['Leyendas'], // 32
  },
  en: {
    novel: ['Novels'], // 791
    tale: ['Short stories'], // 2334
    poetry: ['Poems'], // 2656
    drama: ['Plays', 'Drama'], // 85 + 28
    fable: ['Fables'], // 239
    fairy: ['Fairy tales'], // 291
    children: ["Children's books", "Children's literature"], // 334 + 191
    adventure: ['Adventure novels'], // 243
    scifi: ['Science fiction', 'Science fiction novels'], // 44 + 79
    mystery: ['Mystery novels'], // 394
    romance: ['Romance novels'], // 123
    philosophy: ['Philosophy'], // 145
    history: ['History'], // 93
  },
  fr: {
    novel: ['Romans'], // 85
    tale: ['Contes', 'Nouvelles'], // 549 + 700
    poetry: ['Poésie', 'Poèmes'], // 681 + 62
    drama: ['Théâtre', 'Comédies', 'Tragédies'], // 433 + 121 + 121
    fable: ['Fables'], // 26
    children: ['Littérature jeunesse'], // 119
    scifi: ['Science-fiction'], // 49
    mystery: ['Romans policiers'], // 85
    philosophy: ['Philosophie'], // 566
    history: ['Histoire'], // 161
  },
  de: {
    novel: ['Roman'], // 153
    tale: ['Erzählung'], // 631
    poetry: ['Gedicht'], // 9966
    drama: ['Drama'], // 83
    fable: ['Fabel'], // 45
    fairy: ['Märchen'], // 1935
    philosophy: ['Philosophie'], // 106
    history: ['Geschichte'], // 1102
  },
  ru: {
    novel: ['Романы'], // 1827
    tale: ['Рассказы'], // 15049
    poetry: ['Стихотворения'], // 43991
    drama: ['Пьесы'], // 1740
    fable: ['Басни'], // 278
    fairy: ['Сказки'], // 286
    children: ['Детская литература'], // 1678
    adventure: ['Приключенческая литература'], // 954
    philosophy: ['Философия'], // 740
  },
  pt: {
    fable: ['Fábulas'], // 33
  },
  zh: {
    poetry: ['詩', '詞'], // 42469 + 2728
    drama: ['元曲', '戲曲'], // 11 + 13
    philosophy: ['哲學'], // 32
    history: ['史書', '历史'], // 217 + 337
  },
};

// [DEFAULT_GENRES]: sin género elegido → cuentos y novelas (lo más útil para leer); si el idioma no los tiene, Gutendex
export const DEFAULT_GENRES: readonly BookGenre[] = ['tale', 'novel', 'fable'];

// [wikisourceCategories]: categorías para (idioma, género) · [] = Wikisource no lo cubre → Gutendex
export function wikisourceCategories(
  language: string,
  genre?: BookGenre,
): string[] {
  const table = WIKISOURCE_GENRES[language] ?? {};
  const genres = genre ? [genre] : DEFAULT_GENRES;
  return genres.flatMap((g) => [...(table[g] ?? [])]);
}

// [genreOfCategory · 2026-11-17]: categoría de Wikisource → género del catálogo (para mostrarlo en la tarjeta) | Función pura
export function genreOfCategory(
  language: string,
  category: string,
): BookGenre | null {
  const table = WIKISOURCE_GENRES[language] ?? {};
  const hit = (Object.keys(table) as BookGenre[]).find((g) =>
    table[g]?.includes(category),
  );
  return hit ?? null;
}

// [AUTHOR_NS]: espacio de nombres «Autor» de cada Wikisource (siteinfo, 2026-11-17) · de no tiene (los autores van en el principal)
export const AUTHOR_NS: Readonly<Record<string, number>> = {
  es: 106,
  en: 102,
  fr: 102,
  pt: 102,
  ru: 102,
  zh: 102,
};

// [Ids]: los libros de Wikisource comparten las tablas (int) con Gutenberg → id = 1 000 000 000 + idioma × 100 000 000 + pageid
// ponytail: cabe en int4 mientras pageid < 100 M (en.wikisource ronda 5 M); si no, columna bigint o clave (fuente, id)
const WS_BASE = 1_000_000_000;
const WS_SLOT = 100_000_000;
export const WS_LANGS = ['es', 'en', 'fr', 'de', 'pt', 'ru', 'zh'] as const;
export const wikisourceId = (language: string, pageid: number): number =>
  WS_BASE + WS_LANGS.indexOf(language as never) * WS_SLOT + pageid;
export function parseWikisourceId(
  id: number,
): { language: string; pageid: number } | null {
  if (id < WS_BASE) return null;
  const language = WS_LANGS[Math.floor((id - WS_BASE) / WS_SLOT)];
  return language ? { language, pageid: (id - WS_BASE) % WS_SLOT } : null;
}

export const pageUrl = (language: string, title: string): string =>
  `https://${language}.wikisource.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

// [yearOf]: fecha de Wikidata («+1867-01-18T00:00:00Z», «-0400-…») → año | null
export const yearOf = (time: string | undefined): number | null => {
  const m = time ? /^([+-])0*(\d+)-/.exec(time) : null;
  return m ? (m[1] === '-' ? -1 : 1) * Number(m[2]) : null;
};

// ─── HTML de MediaWiki → texto ───────────────────────────────────────────────
// Sin dependencia nueva: la salida del parser de MediaWiki está bien formada → basta un recorrido de etiquetas con pila
// Se quita lo que Wikisource marca como «no exportar» (cabecera, navegación), números de página, notas y estilos
const VOID = new Set([
  'br',
  'img',
  'hr',
  'meta',
  'link',
  'input',
  'wbr',
  'source',
  'col',
  'area',
]);
const SKIP_TAGS = new Set(['style', 'script', 'sup', 'math', 'noscript']);
const SKIP_CLASS =
  /(?:^|\s)(?:ws-noexport|noprint|pagenum|ws-pagenum|mw-editsection|reference|references|mw-references-wrap|reflist|ws-header|wst-header|headertemplate)(?:\s|$)/;
const BLOCK = new Set([
  'p',
  'div',
  'li',
  'dd',
  'dt',
  'blockquote',
  'tr',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'center',
  'table',
]);
const TAG = /<(\/?)([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)/g;
const NAMED: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  shy: '',
};
export const decodeEntities = (s: string): string =>
  s.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (all, e: string) =>
    e[0] === '#'
      ? String.fromCodePoint(
          e[1] === 'x' || e[1] === 'X'
            ? parseInt(e.slice(2), 16)
            : Number(e.slice(1)),
        )
      : (NAMED[e.toLowerCase()] ?? all),
  );

// [walk]: recorre el HTML visible (sin lo omitido) y avisa de texto, bloques y enlaces | base de htmlToParagraphs y chapterLinks
function walk(
  html: string,
  on: {
    text?(t: string): void;
    block?(): void;
    link?(href: string, cls: string): void;
  },
): void {
  const stack: boolean[] = []; // true = elemento omitido (y todo lo de dentro)
  const skipping = () => stack.includes(true);
  for (const m of html.replace(/<!--[\s\S]*?-->/g, '').matchAll(TAG)) {
    const [, close, rawName, attrs = '', text] = m;
    if (text !== undefined) {
      if (!skipping()) on.text?.(text);
      continue;
    }
    const name = rawName.toLowerCase();
    if (close) {
      if (!VOID.has(name)) stack.pop();
      if (!skipping() && BLOCK.has(name)) on.block?.();
      continue;
    }
    const cls = /\sclass="([^"]*)"/.exec(attrs)?.[1] ?? '';
    if (VOID.has(name) || attrs.trimEnd().endsWith('/')) {
      if (!skipping() && name === 'br') on.block?.(); // Verso → su propio renglón (IPA renglón a renglón)
      // Letra capital dibujada (dropinitial): <img alt="A"> → la letra, si no el texto empieza en «migo!»
      const alt =
        name === 'img' ? /\salt="([^"]*)"/.exec(attrs)?.[1] : undefined;
      if (!skipping() && alt && /^\p{L}$/u.test(alt)) on.text?.(alt);
      continue;
    }
    const skip = SKIP_TAGS.has(name) || SKIP_CLASS.test(cls);
    stack.push(skip);
    if (skipping()) continue;
    if (BLOCK.has(name)) on.block?.();
    if (name === 'a') on.link?.(/\shref="([^"]*)"/.exec(attrs)?.[1] ?? '', cls);
  }
}

// [htmlToParagraphs]: HTML de una página → párrafos de texto limpio (cada verso de un poema es un párrafo)
export function htmlToParagraphs(html: string): string[] {
  const parts: string[] = [];
  let cur = '';
  const flush = () => {
    const p = decodeEntities(cur).replace(/\s+/g, ' ').trim();
    if (p) parts.push(p);
    cur = '';
  };
  walk(html, { text: (t) => (cur += t), block: flush });
  flush();
  return parts;
}

// [chapterLinks]: enlaces a otras obras/capítulos del espacio principal, en el orden de la página (índice de la obra)
// Fuera: espacios con «:» (Autor:, Archivo:…), enlaces rojos (class="new"), interwikis y la propia página
// ponytail: un capítulo cuyo título lleve «:» se pierde; distinguir por el prefijo de espacio si hace falta
export function chapterLinks(html: string, self: string): string[] {
  const out: string[] = [];
  const me = self.replace(/ /g, '_');
  walk(html, {
    link: (href, cls) => {
      if (/(?:^|\s)(?:new|extiw|external)(?:\s|$)/.test(cls)) return;
      const m = /^\/wiki\/([^?#]+)/.exec(href);
      if (!m) return;
      const title = decodeURIComponent(m[1]);
      if (title.includes(':') || title === me || out.includes(title)) return;
      out.push(title);
    },
  });
  return out.map((t) => t.replace(/_/g, ' '));
}

// [versionLink · 2026-11-17]: página de VERSIONES o desambiguación («"Through"» → «Century Magazine/…/"Through"», «Title (Author)»)
// → título de la primera versión con texto; null si no la hay | antes se tomaban sus enlaces como capítulos (revista entera, sin el cuento)
export function versionLink(html: string, self: string): string | null {
  const last = (t: string) => t.split('/').pop() ?? t;
  return (
    chapterLinks(html, self).find(
      (t) =>
        t !== self && (last(t) === self || last(t).startsWith(`${self} (`)),
    ) ?? null
  );
}

// [subpageLinks · 2026-11-17]: capítulos = SOLO subpáginas de la obra («Title/Chapter 1») · fuera la revista, el volumen o el autor que la página enlaza
export const subpageLinks = (html: string, self: string): string[] =>
  chapterLinks(html, self).filter((t) => t.startsWith(`${self}/`));

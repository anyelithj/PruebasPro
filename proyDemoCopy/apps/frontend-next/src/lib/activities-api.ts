import { BookOpen, BookOpenText, Gamepad2, Globe, MessagesSquare, Music, Puzzle, type LucideIcon } from "lucide-react";
import { apiFetch } from "./api-client";
import { getCurrentAccessToken } from "./auth";
import { ApiError } from "./errors";
import { ACTIVITY_ROUTES as R, DECK_GAMES, withReturnTo } from "./activity-kinds"; // [2026-10-24 · SSOT]: rutas Ver/Editar compartidas con «Crear actividad»
// [activities-api · 2026-10-23]: secciones de Actividades (práctica, juegos, música, diálogos, poliglota y gramática) — una SSOT para la página del estudiante
// (/actividades, pestañas como Recursos) y para Gestión → Actividades (tabla con Ver · Editar · Eliminar)
// [Patrón]: Configuration Object + Adapter (cada listado de NestJS → fila común) + Strategy (lista pública / lista propia / borrado por sección)
// [Principio]: OCP (sección nueva = una entrada en ACTIVITY_TABS) + DRY (las dos páginas pintan igual) | [Paradigma]: Declarativo + Funcional
// [Rutas]: ver/editar abren pantallas del remoto Angular (rewrites) → las páginas usan <a> con navegación completa

export type ActivityTab = "practice" | "games" | "music" | "dialogues" | "polyglot" | "grammar" | "reading"; // [2026-10-25]: + lectura
export type ActivityScope = "public" | "mine"; // public = publicadas (estudiante) · mine = propias con borradores (Gestión)

// [ActivityRow]: lo que muestra una fila/tarjeta sea cual sea la sección
export interface ActivityRow {
  id: string;
  title: string;
  description: string;
  language: string | null;
  level: string | null;
  status?: "draft" | "published" | "review" | "rejected" | string;
  blockers?: string[]; // [2026-10-24]: lo que falta para publicar (Música: license | audio | lyrics) → la tabla deshabilita «Publicar» y lo explica
  viewHref: string;
  editHref: string;
}

interface TabDef {
  label: string;
  icon: LucideIcon; // [Icono SVG lucide]: mismo set que el menú lateral (sin emojis)
  description: string;
  // [2026-10-24]: la sección aparece en «¿Qué vas a crear?»; IA / a mano / importar se resuelven EN la página (lib/activity-kinds) → `href` queda como editor Angular de respaldo
  create?: { href: string; label: string };
  list?: (scope: ActivityScope, bearer?: string) => Promise<ActivityRow[]>; // Sin lista = sección sin CRUD (juegos → GAMES)
  remove?: string | ((id: string) => string); // Ruta de NestJS para borrar (con :id) · función si depende del tipo de fila (juegos: catálogo o creado)
  removeNote?: string;
  // [publish · 2026-10-23]: publicar / despublicar como en Recursos → lista de pasos PATCH (ruta + cuerpo) según el destino | sin `publish` = la sección no tiene estado
  publish?: (id: string, publish: boolean) => ReadonlyArray<{ path: string; body: Record<string, string> }>;
}

// [statusPatch]: un solo PATCH { status } (práctica, gramática y poliglota) | Función pura
const statusPatch = (base: string) => (id: string, publish: boolean) => [{ path: `${base}/${enc(id)}`, body: { status: publish ? "published" : "draft" } }];

// [Formas mínimas de las respuestas]: solo lo que se usa
type Named = { id: string; title: string; status?: string; blockers?: string[]; levelStatus?: string; language?: string | null; level?: string | null; levels?: string[]; artist?: string; description?: string; summary?: string };

const enc = encodeURIComponent;
const get = (path: string, bearer?: string) => apiFetch<Named[]>(path, { bearer });
// [rows]: respuesta → filas (las propias incluyen borradores; las públicas solo publicadas) | Función pura
const rows = (xs: Named[], scope: ActivityScope, view: (x: Named) => string, edit: (x: Named) => string): ActivityRow[] =>
  xs
    .filter((x) => scope === "mine" || !x.status || x.status === "published")
    .map((x) => ({
      id: x.id,
      title: x.title,
      description: x.artist || x.description || x.summary || "",
      language: x.language ?? null,
      level: x.level ?? x.levels?.join(", ") ?? null,
      status: x.status,
      ...(x.blockers ? { blockers: x.blockers } : {}), // `...(cond ? {} : {})` (ES2018): la clave solo existe si NestJS la envía
      viewHref: view(x),
      editHref: edit(x),
    }));

// [GAMES · 2026-10-24]: los 18 juegos del remoto Angular (games.routes.ts) — tipo de NestJS → ruta bajo /juegos + nombre y descripción por defecto
// El título, la descripción y el estado editables viven en NestJS (/games/catalog, tabla game_settings); esto solo es el valor por defecto | [Patrón]: Lookup Table
export const GAMES: Readonly<Record<string, { route: string; title: string; description: string }>> = {
  flashcards: { route: "flashcards", title: "Flashcards", description: "Repaso espaciado de vocabulario." },
  memory: { route: "memory", title: "Parejas", description: "Une cada palabra con su traducción." },
  bingo: { route: "bingo", title: "Bingo de palabras", description: "Escucha y marca la palabra." },
  quick_sort: { route: "clasificar", title: "Clasificación rápida", description: "Ordena palabras por categoría." },
  recovery_drills: { route: "recuperacion", title: "Recuperación rápida", description: "Responde rápido hasta que la palabra salga sola." },
  forbidden_word: { route: "palabra-prohibida", title: "Palabra prohibida", description: "Describe sin decir la palabra." },
  taboo: { route: "tabu", title: "Tabú", description: "Adivina con pistas del agente." },
  twenty_questions: { route: "20-preguntas", title: "20 preguntas", description: "Descubre el objeto preguntando." },
  describe_guess: { route: "describe-adivina", title: "Describe y adivina", description: "El agente describe y tú adivinas." },
  chained_story: { route: "historia", title: "Historia encadenada", description: "Crea una historia por turnos." },
  debate: { route: "debate", title: "Debate rápido", description: "Argumenta a favor o en contra." },
  role_play: { route: "role-play", title: "Role-play", description: "Conversa en una situación real y cumple objetivos." },
  random_topic: { route: "tema", title: "Tema al azar", description: "Habla un minuto sobre un tema sorpresa." },
  speed_speaking: { route: "speed-speaking", title: "Hablar contra reloj", description: "Habla 30, 60 y 90 segundos." },
  shadowing: { route: "shadowing", title: "Shadowing", description: "Escucha y repite imitando el ritmo." },
  partial_dictation: { route: "dictado", title: "Dictado parcial", description: "Escribe la palabra que falta." },
  listen_reformulate: { route: "reformula", title: "Escucha y reformula", description: "Dilo con otras palabras." },
  quick_qa: { route: "pregunta-rapida", title: "Pregunta-respuesta rápida", description: "Responde el dato clave lo antes posible." },
};
type CatalogGame = { type: string; title: string | null; description: string | null; status: string };
type Deck = { id: string; gameType: string; title: string; language: string; level: string | null; status: string; items: unknown[] };
// [isDeckId · 2026-10-25]: en la pestaña Juegos conviven el catálogo (id = tipo, «flashcards») y los juegos creados (id = UUID)
const isDeckId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);


// [ACTIVITY_TABS]: SSOT de las secciones | `Readonly<Record<…>>` (TS): una entrada por pestaña, inmutable
export const ACTIVITY_TABS: Readonly<Record<ActivityTab, TabDef>> = {
  practice: {
    label: "Práctica",
    icon: Puzzle,
    description: "Ejercicios (opción múltiple, huecos, ordenar, marcar errores…) con contenidos vinculados: vocabulario, juegos, canciones y diálogos.",
    create: { href: "/practica/constructor", label: "Crear actividad" },
    list: async (scope, b) => rows(await get(`/practice/activities${scope === "mine" ? "?mine=true" : ""}`, b), scope, (x) => R.practice.view(x.id), (x) => R.practice.edit(x.id)),
    remove: "/practice/activities/:id",
    removeNote: "La actividad se archiva y deja de verse.",
    publish: statusPatch("/practice/activities"),
  },
  games: {
    label: "Juegos",
    icon: Gamepad2,
    description: "Juegos con el banco de contenido y el agente de IA. Para un juego con tu propio material, crea una actividad de Práctica y vincula el vocabulario y el juego.",
    create: { href: "/admin/activities/new?tab=games", label: "Crear juego" }, // [2026-10-25]: juego con material propio (IA, importar o a mano)
    // [2026-10-24]: catálogo de NestJS (el personal recibe también los borradores) → Ver · Editar (título y descripción) · Despublicar · Eliminar (archivar)
    list: async (scope, b) => [
      // [2026-10-25]: primero los juegos creados con material propio (se juegan con ?mazo=)
      ...(await apiFetch<Deck[]>(`/games/decks${scope === "mine" ? "?mine=true" : ""}`, { bearer: b }).catch(() => [] as Deck[])).map((d) => {
        const g = DECK_GAMES.find((x) => x.value === d.gameType);
        return {
          id: d.id,
          title: d.title,
          description: `${g?.label ?? d.gameType} · ${d.items.length} palabras`,
          language: d.language,
          level: d.level,
          status: d.status,
          viewHref: `/juegos/${g?.route ?? ""}?mazo=${enc(d.id)}&lang=${enc(d.language)}`,
          editHref: "",
        };
      }),
      ...(await apiFetch<{ games: CatalogGame[] }>("/games/catalog", { bearer: b })).games
        .filter((g) => GAMES[g.type] && (scope === "mine" || g.status === "published"))
        .map((g) => ({
          id: g.type,
          title: g.title || GAMES[g.type]!.title,
          description: g.description || GAMES[g.type]!.description,
          language: null,
          level: null,
          status: g.status,
          viewHref: `/juegos/${GAMES[g.type]!.route}`,
          editHref: `/admin/activities/juegos/${enc(g.type)}`,
        })),
    ],
    remove: (id) => (isDeckId(id) ? "/games/decks/:id" : "/games/catalog/:id"),
    removeNote: "El juego deja de mostrarse y de poder jugarse.",
    publish: (id, publish) => [{ path: `/games/${isDeckId(id) ? "decks" : "catalog"}/${enc(id)}`, body: { status: publish ? "published" : "draft" } }],
  },
  music: {
    label: "Música",
    icon: Music,
    description: "Canciones con letra, IPA, traducción y karaoke sincronizado.",
    create: { href: "/musica/subir", label: "Subir canción" }, // Asistente Angular: la letra se importa de archivo/URL/audio en el mismo formulario
    list: async (scope, b) => rows(await get(`/music/songs${scope === "mine" ? "?mine=true" : ""}`, b), scope, (x) => R.music.view(x.id), (x) => R.music.edit(x.id)),
    remove: "/music/songs/:id",
    removeNote: "La canción y su audio se retiran.",
    // [Máquina de estados de Music]: borrador → revisión → publicada (publicar lo decide el ADMIN) · despublicar = volver a borrador
    publish: (id, publish) =>
      publish
        ? [{ path: `/music/songs/${enc(id)}/status`, body: { status: "review" } }, { path: `/music/songs/${enc(id)}/status`, body: { status: "published" } }]
        : [{ path: `/music/songs/${enc(id)}/status`, body: { status: "draft" } }],
  },
  dialogues: {
    label: "Diálogos",
    icon: MessagesSquare,
    description: "Diálogos con IPA y traducción, y conversación con el avatar.",
    create: { href: "/dialogos/subir", label: "Crear diálogo" },
    // [2026-10-24]: el diálogo no tiene `status` → «publicado» = nivel confirmado (visible en la biblioteca) · «borrador» = nivel estimado
    list: async (scope, b) =>
      rows((await get(`/dialogues${scope === "mine" ? "?mine=true" : ""}`, b)).map((x) => ({ ...x, status: x.levelStatus === "confirmed" ? "published" : "draft" })), scope, (x) => R.dialogues.view(x.id), (x) => R.dialogues.edit(x.id)),
    remove: "/dialogues/:id",
    removeNote: "El diálogo se retira de la biblioteca.",
    publish: (id, publish) => [{ path: `/dialogues/${enc(id)}/status`, body: { status: publish ? "published" : "draft" } }],
  },
  polyglot: {
    label: "Poliglota",
    icon: Globe,
    description: "Un tema en los siete idiomas lado a lado, con IPA.",
    create: { href: "/poliglota/administrar", label: "Crear tema" },
    list: async (scope, b) => rows(await get("/polyglot/topics", b), scope, () => R.polyglot.view(""), (x) => R.polyglot.edit(x.id)),
    remove: "/polyglot/topics/:id",
    removeNote: "El tema se archiva.",
    publish: statusPatch("/polyglot/topics"),
  },
  grammar: {
    label: "Gramática",
    icon: BookOpen,
    description: "Fichas con uso, fórmula, negativa, interrogativa y ejemplos con IPA y traducción.",
    create: { href: "/gramatica/editor", label: "Crear ficha" },
    list: async (scope, b) => rows(await get(`/grammar/topics${scope === "mine" ? "?mine=1" : ""}`, b), scope, (x) => R.grammar.view(x.id), (x) => R.grammar.edit(x.id)),
    remove: "/grammar/topics/:id",
    removeNote: "La ficha se archiva.",
    publish: statusPatch("/grammar/topics"),
  },
  // [2026-10-25 · Lectura]: textos por género con traducción, IPA, audio y marcador · Ver = lector Angular (/lectura/:id) · Editar = editor de frases de Next.js
  reading: {
    label: "Lectura",
    icon: BookOpenText,
    description: "Textos por género (cuento, fábula, poema, noticia…) con traducción por frase, IPA, audio con resaltado y marcador de lectura.",
    create: { href: "/admin/activities/new?tab=reading", label: "Crear lectura" },
    list: async (scope, b) => rows(await get(`/reading/texts${scope === "mine" ? "?mine=true" : ""}`, b), scope, (x) => R.reading.view(x.id), (x) => R.reading.edit(x.id)),
    remove: "/reading/texts/:id",
    removeNote: "La lectura se retira y deja de verse.",
    publish: statusPatch("/reading/texts"),
  },
};

// [withReturn · 2026-10-23]: añade ?volver=/admin/activities?tab=… a una pantalla del remoto Angular → su «Volver» y su salida regresan a esta pestaña de Gestión | [Paradigma]: Funcional (pura)
export const withReturn = (href: string, tab: ActivityTab): string => withReturnTo(href, `/admin/activities?tab=${tab}`); // [2026-10-24 · DRY]: misma función que el panel «Actividad creada»

// [2026-10-25]: Gramática ya no es una sección de Actividades (se practica en «Práctica» con «¿Qué practica? → Gramática»); sus fichas siguen en /gramatica
export const ACTIVITY_TAB_KEYS: ActivityTab[] = (Object.keys(ACTIVITY_TABS) as ActivityTab[]).filter((k) => k !== "grammar");
export const STATUS_LABEL: Readonly<Record<string, string>> = { draft: "Borrador", published: "Publicada", review: "En revisión", rejected: "Rechazada" };
// [BLOCKER_LABEL · 2026-10-24]: requisitos de publicación de NestJS (music/domain/song-readiness) → texto corto de la tabla | [Patrón]: Lookup Table
export const BLOCKER_LABEL: Readonly<Record<string, string>> = { license: "licencia", audio: "audio", lyrics: "letra" };

// [parseTab]: valor de la URL → pestaña válida (o la primera) | [Fail Fast]: nunca se usa un valor arbitrario
export const parseTab = (v: string | undefined, fallback: ActivityTab = "practice"): ActivityTab => (ACTIVITY_TAB_KEYS.includes(v as ActivityTab) ? (v as ActivityTab) : fallback);

// [listActivities]: filas de la sección con el token de la sesión
export async function listActivities(tab: ActivityTab, scope: ActivityScope): Promise<ActivityRow[]> {
  const def = ACTIVITY_TABS[tab];
  return def.list ? def.list(scope, (await getCurrentAccessToken()) ?? undefined) : [];
}

// [setActivityPublished · 2026-10-23]: recorre los pasos de la sección; si un paso ya está hecho (p. ej. la canción ya estaba en revisión) el backend lo rechaza y se sigue con el siguiente
export async function setActivityPublished(tab: ActivityTab, id: string, publish: boolean): Promise<void> {
  const steps = ACTIVITY_TABS[tab].publish?.(id, publish);
  if (!steps) throw new Error("Esta sección no se publica.");
  const bearer = (await getCurrentAccessToken()) ?? undefined;
  for (const [i, step] of steps.entries()) {
    try {
      await apiFetch(step.path, { method: "PATCH", body: step.body, bearer });
    } catch (err) {
      // Pasos intermedios ya hechos (403 «No se puede pasar de…») se ignoran; el último (el destino) sí debe cumplirse
      // [2026-10-24]: un 400 intermedio es un requisito que falta («Falta subir el audio») → se muestra ESE motivo, no el 403 confuso del paso siguiente
      if (i === steps.length - 1 || (err instanceof ApiError && err.status === 400)) throw err;
    }
  }
}

// [removeActivity]: DELETE en NestJS (borrado lógico en todas las secciones)
export async function removeActivity(tab: ActivityTab, id: string): Promise<void> {
  const remove = ACTIVITY_TABS[tab].remove;
  const path = typeof remove === "function" ? remove(id) : remove;
  if (!path) throw new Error("Esta sección no admite eliminar.");
  await apiFetch(path.replace(":id", enc(id)), { method: "DELETE", bearer: (await getCurrentAccessToken()) ?? undefined });
}

// [Test activity-kinds · 2026-10-24]: estrategias de «Crear actividad» — mapeo de lo importado, ida y vuelta de ítems, validación y guardado con un ApiPort falso
// [Patrón]: Unit Test de funciones puras + Test Double (Fake del puerto de salida) | [Principio]: DIP → se prueba el guardado sin red ni tokens
import { ACTIVITY_KINDS, diffRows, emptyDraft, entryToItem, isCreatableKind, itemProblem, itemToEntry, mergeDraft, parseScript, rowsToConcepts, rowsToPracticeEntries, validateDraft, withReturnTo, type ApiPort, type EditApiPort } from "@/lib/activity-kinds";

const ctx = { language: "en", level: "A2" };
const src = { label: "lista.xlsx" };

// [fakeApi]: registra cada POST y devuelve ids correlativos | `jest.fn` permite inspeccionar las llamadas
const fakeApi = () => {
  let n = 0;
  const post = jest.fn(async (path: string) => ({ id: `${path.split("/")[1]}-${++n}` }));
  return { api: { post } as unknown as ApiPort, post };
};

describe("práctica", () => {
  it("filas → opción múltiple, huecos o respuesta abierta (y salta encabezados)", () => {
    const entries = rowsToPracticeEntries([["Pregunta", "Respuesta"], ["Capital of France?", "Paris", "Rome", "Berlin"], ["I ___ tired.", "am"], ["Say hello", "Hello"], ["solo"]]);
    expect(entries.map((e) => e.itemType)).toEqual(["multiple_choice", "fill_blank", "open_answer"]);
    expect(entries[0]!.options.split("\n")).toEqual(["Berlin", "Paris", "Rome"]); // Opciones ordenadas: la correcta no queda siempre primera
  });
  it("ida y vuelta ítem ↔ fila conserva el contenido", () => {
    const item = { itemType: "fill_blank" as const, skill: "grammar", prompt: "I ___ to ___.", options: [], accepted: [["went", "had gone"], ["school"]] };
    expect(entryToItem(itemToEntry(item), "grammar")).toEqual(item);
    const order = entryToItem({ itemType: "drag_order", prompt: "Ordena", answer: "I am happy", options: "" }, "structure");
    expect(order.accepted).toEqual([["I", "am", "happy"]]);
    expect([...order.options].sort()).toEqual(["I", "am", "happy"].sort());
  });
  it("itemProblem detecta la respuesta fuera de las opciones", () => {
    expect(itemProblem(entryToItem({ itemType: "multiple_choice", prompt: "?", options: "a\nb", answer: "c" }, "vocabulary"))).toMatch(/una de las opciones/);
    expect(itemProblem(entryToItem({ itemType: "multiple_choice", prompt: "?", options: "a\nb", answer: "a" }, "vocabulary"))).toBeNull();
  });
  it("guarda con un solo POST y vincula el audio/video como contenido", async () => {
    const { api, post } = fakeApi();
    const draft = { title: "Food", meta: { skill: "vocabulary", mediaUrl: "https://x.test/a.mp3" }, entries: [{ itemType: "open_answer", prompt: "Say hi", answer: "Hi" }] };
    expect(validateDraft("practice", draft, ctx)).toEqual([]);
    const res = await ACTIVITY_KINDS.practice.persist(draft, ctx, api);
    expect(res.id).toBe("practice-1");
    expect(post).toHaveBeenCalledWith("/practice/activities", expect.objectContaining({ language: "en", level: "A2", contents: [{ kind: "link", label: "Audio / video", href: "https://x.test/a.mp3" }] }));
  });
});

describe("diálogos", () => {
  it("parseScript lee «Nombre: frase» con dos personajes", () => {
    expect(parseScript("Ana: Hi!\nTom: Hello.\nAna: How are you?")).toEqual({ speakers: ["Ana", "Tom"], turns: [{ speaker: "A", text: "Hi!" }, { speaker: "B", text: "Hello." }, { speaker: "A", text: "How are you?" }] });
    expect(parseScript("una línea sin guion")).toBeNull();
  });
  it("sin guion alterna A/B y toma la fuente del enlace para la licencia", () => {
    const d = ACTIVITY_KINDS.dialogues.fromExtracted({ rows: [], text: "Hello\nHi there" }, ctx, { label: "https://x.test/p", url: "https://x.test/p" });
    expect(d.entries).toEqual([{ speaker: "A", text: "Hello" }, { speaker: "B", text: "Hi there" }]);
    expect(d.meta?.licenseSource).toBe("https://x.test/p");
  });
  it("exige licencia confirmada y dos hablantes (texto importado)", () => {
    const base = emptyDraft("dialogues");
    const draft = { ...base, meta: { ...base.meta, origin: "import" }, title: "Café", entries: [{ speaker: "A", text: "Hi" }, { speaker: "A", text: "Bye" }] };
    const p = validateDraft("dialogues", draft, ctx).join(" ");
    expect(p).toMatch(/dos hablantes/);
    expect(p).toMatch(/licencia/);
    expect(p).toMatch(/Titular de los derechos/);
  });
  // [2026-10-27]: con IA o escrito a mano NO se piden los datos de derechos (los pone NestJS como obra propia)
  it.each(["ai", "own"])("origen «%s»: sin titular ni confirmación de licencia", async (origin) => {
    const base = emptyDraft("dialogues");
    const draft = { ...base, meta: { ...base.meta, origin }, title: "Café", entries: [{ speaker: "A", text: "Hi" }, { speaker: "B", text: "Hello" }] };
    expect(validateDraft("dialogues", draft, ctx)).toEqual([]);
    const { api, post } = fakeApi();
    await ACTIVITY_KINDS.dialogues.persist(draft, ctx, api);
    const body = (post.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(body.origin).toBe(origin);
    expect(body.license).toBeUndefined();
    expect(body.level).toBe(ctx.level);
  });
});

describe("gramática", () => {
  it("reutiliza el lector de reglas de Recursos (título, fórmula y ejemplos)", () => {
    const d = ACTIVITY_KINDS.grammar.fromExtracted({ rows: [], text: "Present perfect\nFórmula: Subject + have + participle\nSe usa para hablar de experiencias en un momento no definido.\nI have eaten the apple. - Yo he comido la manzana." }, ctx, src);
    expect(d.title).toBe("Present perfect");
    expect(d.meta?.formula).toBe("Subject + have + participle");
    expect(d.entries).toEqual([{ text: "I have eaten the apple." }]);
    expect(d.meta?.usage).toMatch(/^Se usa/);
  });
  // [2026-10-27]: los ejemplos van con `?defer=true` → NestJS completa IPA + traducción en segundo plano (ya no hay llamada síncrona a /enrich)
  it("guarda tema → secciones → ejemplos diferidos (IPA/traducción en segundo plano)", async () => {
    const { api, post } = fakeApi();
    const res = await ACTIVITY_KINDS.grammar.persist({ title: "PP", meta: { usage: "Experiencias", formula: "S + have" }, entries: [{ text: "I have eaten." }] }, ctx, api);
    expect(res).toEqual({ id: "grammar-1", warnings: [] });
    expect(post.mock.calls.map((c) => c[0])).toEqual(["/grammar/topics", "/grammar/topics/grammar-1/sections", "/grammar/topics/grammar-1/sections", "/grammar/sections/grammar-2/examples?defer=true"]);
  });
});

describe("poliglota", () => {
  it("columnas por idioma con encabezados o «término | significado» sin ellos", () => {
    expect(rowsToConcepts([["Inglés", "Español", "Francés"], ["apple", "manzana", "pomme"]], "en")).toEqual([{ kind: "word", en: "apple", es: "manzana", fr: "pomme" }]);
    expect(rowsToConcepts([["good morning to you", "buenos días"]], "en")[0]).toEqual({ kind: "phrase", en: "good morning to you", es: "buenos días" });
  });
  it("un concepto que falla se informa sin perder el tema", async () => {
    const post = jest.fn(async (path: string) => {
      if (path.includes("/terms")) throw new Error("IPA caída");
      return { id: "t1" };
    });
    const res = await ACTIVITY_KINDS.polyglot.persist({ title: "Frutas", meta: { category: "vocabulary" }, entries: [{ kind: "word", en: "apple" }] }, { language: "", level: "" }, { post } as unknown as ApiPort);
    expect(res.id).toBe("t1");
    expect(res.warnings[0]).toMatch(/IPA caída/);
  });
  // [2026-10-27]: conceptos en paralelo acotado (3) sin perder la posición ni el orden de los avisos
  it("guarda varios conceptos a la vez (máx. 3) con su posición", async () => {
    let running = 0;
    let peak = 0;
    const bodies: Array<{ position?: number }> = [];
    const post = jest.fn(async (path: string, body?: unknown) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      if (path.endsWith("/concepts")) bodies.push(body as { position?: number });
      return { id: path === "/polyglot/topics" ? "t1" : "c1" };
    });
    const entries = Array.from({ length: 7 }, (_, i) => ({ kind: "word", en: `w${i}` }));
    const res = await ACTIVITY_KINDS.polyglot.persist({ title: "Frutas", meta: { category: "vocabulary" }, entries }, { language: "", level: "" }, { post } as unknown as ApiPort);
    expect(res).toEqual({ id: "t1", warnings: [] });
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(3);
    expect(bodies.map((b) => b.position).sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe("utilidades", () => {
  it("mergeDraft no pisa lo escrito y añade filas", () => {
    const cur = { title: "Mío", meta: { skill: "grammar", description: "" }, entries: [{ a: "1" }] };
    expect(mergeDraft(cur, { title: "Otro", meta: { skill: "vocabulary", description: "x" }, entries: [{ a: "2" }] })).toEqual({ title: "Mío", meta: { skill: "grammar", description: "x" }, entries: [{ a: "1" }, { a: "2" }] });
  });
  it("isCreatableKind y withReturnTo", () => {
    expect(isCreatableKind("music")).toBe(false);
    expect(isCreatableKind("grammar")).toBe(true);
    expect(withReturnTo("/a?x=1", "/admin/activities?tab=grammar")).toBe("/a?x=1&volver=%2Fadmin%2Factivities%3Ftab%3Dgrammar");
  });
});

// [2026-10-25 · Juegos con material propio]: importar «palabra | traducción | categoría», validar y guardar en /games/decks
describe("estrategia «Juego»", () => {
  const games = ACTIVITY_KINDS.games;
  it("importa filas cortas como palabras y descarta párrafos", () => {
    const part = games.fromExtracted({ rows: [["Palabra", "Traducción"], ["apple", "manzana", "food"], ["This is a very long sentence indeed", "x"]], text: "" }, ctx, src);
    expect(part.entries).toEqual([{ term: "apple", translation: "manzana", emoji: "", category: "food" }]);
  });
  it("exige 2 palabras y 2 categorías en clasificación rápida; guarda con un POST", async () => {
    const d = { title: "Food", meta: { gameType: "quick_sort" }, entries: [{ term: "apple", category: "food" }, { term: "car", category: "food" }] };
    expect(validateDraft("games", d, ctx)).toContain("«Clasificación rápida» necesita al menos 2 categorías distintas.");
    const { api, post } = fakeApi();
    await games.persist({ ...d, meta: { gameType: "memory" } }, ctx, api);
    expect(post).toHaveBeenCalledWith("/games/decks", expect.objectContaining({ gameType: "memory", language: "en", items: [{ term: "apple", category: "food" }, { term: "car", category: "food" }] }));
  });
});

// [2026-10-27]: «Editar» en Next.js → diff de filas (PATCH lo cambiado · POST lo nuevo · DELETE lo quitado)
describe("diffRows (editar)", () => {
  it("separa filas nuevas, cambiadas y quitadas", () => {
    const current = [{ _id: "1", text: "Hi" }, { _id: "2", text: "Bye" }];
    const next = [{ _id: "1", text: "Hello" }, { text: "New" }];
    const d = diffRows(next, current, ["text"]);
    expect(d.added).toEqual([{ text: "New" }]);
    expect(d.changed.map((c) => c.entry._id)).toEqual(["1"]);
    expect(d.removed).toEqual(["2"]);
  });
  it("diálogos: cambiar el texto sin tocar la IPA la vacía (se regenera)", async () => {
    const patch = jest.fn(async () => ({}));
    const api = { post: jest.fn(async () => ({})), get: jest.fn(), patch, del: jest.fn(async () => undefined) } as unknown as EditApiPort;
    const current = { title: "Café", meta: { speakerA: "Ana", speakerB: "Tom" }, entries: [{ _id: "t1", speaker: "A", text: "Hi", ipa: "haɪ", translation: "Hola" }] };
    const next = { ...current, entries: [{ ...current.entries[0]!, text: "Hello" }] };
    await ACTIVITY_KINDS.dialogues.edit!.save("d1", next, current, ctx, api);
    expect(patch).toHaveBeenCalledWith("/dialogue-turns/t1", { speaker: "A", text: "Hello", ipa: "", translation: "" });
  });
});

// [2026-11-11 · Poliglota en Next.js]: carga de la tabla → borrador · guardar = PATCH tema (nivel + idiomas) + diff de conceptos y términos
describe("polyglot.edit", () => {
  const raw = {
    topic: { title: "Familia", category: "vocabulary", levels: ["A1"], languages: ["en", "es"] },
    rows: [{ concept: { id: "c1", kind: "word", emoji: "👪", imageUrl: null }, terms: { en: { id: "t-en", text: "family" }, es: { id: "t-es", text: "familia" }, fr: null } }],
  };
  it("carga emoji/imagen, idiomas, nivel e ids de términos", () => {
    const { draft, ctx: c } = ACTIVITY_KINDS.polyglot.edit!.load(raw);
    expect(c.level).toBe("A1");
    expect(draft.meta.languages).toBe("en,es");
    expect(draft.entries[0]).toMatchObject({ emoji: "👪", image: "", en: "family", _t_en: "t-en", _id: "c1" });
  });
  it("guardar: imagen adjunta, término cambiado, término vaciado y concepto nuevo", async () => {
    const current = ACTIVITY_KINDS.polyglot.edit!.load(raw).draft;
    const img = "data:image/webp;base64,AAAA";
    const next = { ...current, entries: [{ ...current.entries[0]!, image: img, en: "the family", es: "" }, { kind: "word", emoji: "🐶", image: "", en: "dog", es: "perro" }] };
    const patch = jest.fn(async () => ({}));
    const post = jest.fn(async () => ({ id: "c2" }));
    const del = jest.fn(async () => undefined);
    await ACTIVITY_KINDS.polyglot.edit!.save("p1", next, current, { language: "", level: "A2" }, { post, patch, del, get: jest.fn() } as unknown as EditApiPort);
    expect(patch).toHaveBeenCalledWith("/polyglot/topics/p1", expect.objectContaining({ levels: ["A2"], languages: ["en", "es"] }));
    expect(patch).toHaveBeenCalledWith("/polyglot/concepts/c1", expect.objectContaining({ imageUrl: img, emoji: "👪" }));
    expect(post).toHaveBeenCalledWith("/polyglot/concepts/c1/terms", { terms: [{ language: "en", text: "the family" }] });
    expect(del).toHaveBeenCalledWith("/polyglot/terms/t-es");
    expect(post).toHaveBeenCalledWith("/polyglot/topics/p1/concepts", expect.objectContaining({ emoji: "🐶", position: 1, gloss: "perro" }));
  });
});

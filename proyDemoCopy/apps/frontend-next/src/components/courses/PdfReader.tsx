"use client"; // [Next.js]: Client Component → usa APIs del navegador (Web Speech, Translator, Selection, Web Worker)
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom"; // [Fix 2026-10-30]: `createPortal` (React DOM): pinta la tarjeta en <body> → un ancestro con `transform` (animación fade-in) convertía `position: fixed` en relativo a él y la tarjeta salía fuera de la pantalla
import { usePreferences } from "@/components/layout/PreferencesProvider";
import { fmt } from "@aula/shared-i18n";
import { pdfText, pdfOcrText, pdfBlocks, stripPageFurniture } from "@/lib/pdf-text";
import { pickVoice, utterance as makeUtterance } from "@/lib/speech"; // [DRY]: misma selección de voz que las fichas de vocabulario
import { courseVocab, markCourseWords, splitByLanguage, UNDETERMINED, type LangChunk } from "@/lib/lang-detect"; // [2026-10-28]: la voz solo lee el idioma del curso
import { WordCard } from "@/components/reading/WordCard"; // [2026-10-28]: tarjeta de palabra (IPA + traducción + Aprender)
import { termKey, useMarkedWords } from "@/hooks/useVocabulary";
import { cn } from "@/lib/utils";
// [PdfReader]: lectura en voz alta del texto del PDF con resaltado de frase + palabra, traducción completa al español (párrafo a párrafo) y traducción de la selección (palabra o párrafo)
// [2026-10-28]: 1) la voz lee SOLO el idioma del curso (las explicaciones en español se muestran atenuadas y se saltan) · 2) cada palabra se pulsa → tarjeta con 🔊, IPA, traducción y «Aprender/Aprendido» (banco de vocabulario existente)
// [Tecnologías]: pdf.js (extracción de texto en un Web Worker) + Web Speech API `speechSynthesis` (TTS nativo) + Translator API del navegador (on-device) + Selection API + Intl.Segmenter / Intl.DisplayNames
// [Patrón]: Adapter (APIs del navegador → estado React) + State Machine (idle/playing/paused) + Cache (traducciones) + Singleton perezoso (un traductor por lección) | [Principio]: SRP + Progressive Enhancement | [Paradigma]: Reactivo + Declarativo + Asíncrono
// [Rendimiento]: pdf.js se carga con `import()` dinámico solo al abrir un PDF; los párrafos se traducen en secuencia (no satura el modelo local)

// [Translator API]: aún sin tipos en lib.dom → contrato mínimo propio | `interface` (TS)
interface BrowserTranslator {
  translate(text: string): Promise<string>;
}
interface TranslatorFactory {
  availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<string>; // "unavailable" | "downloadable" | "available"…
  create(o: { sourceLanguage: string; targetLanguage: string }): Promise<BrowserTranslator>;
}

interface Sentence {
  text: string;
  para: number; // Párrafo al que pertenece (para conservar la maquetación)
}

// [Selección a traducir]: texto + posición del popover (viewport) + resultado | `undefined` = traduciendo, `null` = sin traductor
interface SelectionTr {
  text: string;
  x: number;
  y: number;
  out?: string | null;
}

type LoadState = "loading" | "ready" | "error";
type PlayState = "idle" | "playing" | "paused";

const RATES = [0.75, 1, 1.25, 1.5] as const; // `as const` (TS): tupla de literales de solo lectura
const MAX_SELECTION = 2000; // Límite de caracteres traducidos por selección
const POPOVER_W = 320; // Ancho del popover (px) para mantenerlo dentro de la pantalla

// [extractSentences]: PDF → frases | `async` (ES2017) + `for` secuencial (las páginas se leen en orden) | [Paradigma]: Funcional (sin estado React)
// `onOcr` (Sprint 2.5): sin capa de texto (PDF escaneado) → OCR con Tesseract.js página a página (avisa el progreso)
async function extractSentences(src: string, lang: string, onOcr?: (page: number, total: number) => void): Promise<Sentence[]> {
  let raw = await pdfText({ url: src }); // [DRY]: extracción compartida con la importación de recursos (lib/pdf-text)
  if (!raw.replace(/\s+/g, "")) raw = await pdfOcrText(src, lang, onOcr);
  const segmenter = new Intl.Segmenter(lang, { granularity: "sentence" }); // `Intl.Segmenter` (ES2022): corta frases según el idioma
  return pdfBlocks(stripPageFurniture(raw)) // [2026-11-16]: sin pies/encabezados de página · [Fix 2026-10-30]: enunciados, numeración y títulos en su propia línea (antes todo el PDF en un solo bloque «revuelto»)
    // `flatMap` (ES2019) + `Array.from(iterable, map)`: párrafos → frases con su índice de párrafo
    .flatMap((p, para) => Array.from(segmenter.segment(p), (s) => ({ text: s.segment.trim(), para })).filter((s) => s.text));
}

// [serverTranslator · Sprint 2.5]: navegadores sin Translator API (Firefox, Safari…) traducen con el servicio de la plataforma
// (BFF → NestJS → FastAPI /language-tools/translate, LLM local) en trozos de ≤ 500 caracteres (límite del servicio) | [Patrón]: Adapter (mismo contrato BrowserTranslator)
function serverTranslator(source: string, target: string): BrowserTranslator {
  const one = async (text: string) => {
    const res = await fetch("/api/vocabulary/lookup/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, source, target }) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // [Fix 2026-10-27]: sobre { statusCode, data } de NestJS (TransformInterceptor) → antes devolvía `undefined` | `?.data ?? body` acepta ambos
    const body = (await res.json()) as { data?: { translation?: string }; translation?: string };
    return (body.data ?? body).translation ?? "";
  };
  return {
    async translate(text: string) {
      // [Trozos]: por frases hasta 500 caracteres → cada llamada cabe en el límite y el orden se conserva
      const parts: string[] = [];
      for (const s of text.split(/(?<=[.!?。！？])\s+/)) {
        const last = parts.at(-1);
        if (last !== undefined && (last + " " + s).length <= 500) parts[parts.length - 1] = last + " " + s;
        else parts.push(s.slice(0, 500));
      }
      const out: string[] = [];
      for (const part of parts) out.push(await one(part)); // Secuencial: no satura el modelo local
      return out.join(" ");
    },
  };
}

// [createTranslator]: Translator API del navegador (on-device) si admite el par; si no, el traductor del servidor | [Patrón]: Feature Detection + Fallback
async function createTranslator(sourceLanguage: string, targetLanguage: string): Promise<BrowserTranslator | null> {
  const factory = (globalThis as { Translator?: TranslatorFactory }).Translator;
  try {
    const opts = { sourceLanguage, targetLanguage };
    if (factory && (await factory.availability(opts)) !== "unavailable") return await factory.create(opts); // Puede descargar el modelo la primera vez (requiere gesto del usuario)
  } catch {
    // Sigue con el servidor
  }
  return serverTranslator(sourceLanguage, targetLanguage);
}

// [googleTranslateUrl]: fallback cuando el navegador no trae traductor (el usuario decide abrirlo) | [Principio]: DRY
const googleTranslateUrl = (sl: string, tl: string, text: string) =>
  `https://translate.google.com/?sl=${sl}&tl=${tl}&text=${encodeURIComponent(text.slice(0, 4500))}&op=translate`;

// [Suscripciones a speechSynthesis]: `useSyncExternalStore` (React 18) lee estado externo del navegador sin desajuste de hidratación
const noopSubscribe = () => () => {};
const subscribeVoices = (cb: () => void) => {
  if (!("speechSynthesis" in window)) return () => {};
  speechSynthesis.addEventListener("voiceschanged", cb); // Las voces se cargan de forma asíncrona
  return () => speechSynthesis.removeEventListener("voiceschanged", cb);
};

// ───────── [2026-10-28 · Un solo idioma + palabras pulsables] ─────────
// [Token]: palabra o separador de una frase con su posición | `Intl.Segmenter` granularity "word" (ES2022) → también chino (sin espacios)
interface Token {
  text: string;
  start: number;
  word: boolean; // `isWordLike` → palabra pulsable
}
// [RichSentence]: frase → trozos por idioma (lib/lang-detect) con sus tokens → se pintan, colorean y leen por separado
interface RichChunk extends LangChunk {
  tokens: Token[];
}
// [SpeechStep]: unidad de la cola de voz = trozo EN EL IDIOMA DEL CURSO (las explicaciones en otro idioma no entran)
interface SpeechStep {
  i: number; // Frase
  c: number; // Trozo dentro de la frase
}
// [WordTarget]: palabra abierta en la tarjeta
interface WordTarget {
  word: string;
  i: number;
  rect: DOMRect;
  el: HTMLElement | null;
}

const MAX_WORD = 60; // = @MaxLength de LookupWordDto
// Clave de palabra en el DOM: «frase:token» | `data-wi` (atributo data-*) → delegación de eventos en el contenedor (un listener, no miles)
const wordKey = (i: number, t: number) => `${i}:${t}`;

// [textSentences · 2026-11-16]: texto Markdown (temario) → frases con su párrafo, sin marcas (#, **, `, >, viñetas, enlaces) | [Paradigma]: Funcional (pura)
export function textSentences(md: string, lang: string): Sentence[] {
  const clean = (s: string) =>
    s
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // Imágenes fuera
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // [texto](url) → texto
      .replace(/^\s{0,3}(?:#{1,6}|>|[-*+]|\d+[.)])\s+/gm, "") // Encabezados, citas y viñetas
      .replace(/[*_`~|]+/g, " ") // Énfasis, código y tablas
      .replace(/\s+/g, " ")
      .trim();
  const segmenter = new Intl.Segmenter(lang, { granularity: "sentence" });
  return md
    .split(/\n\s*\n|\n(?=\s*(?:#{1,6}|[-*+]|\d+[.)])\s)/) // Párrafos: línea en blanco, encabezado o viñeta
    .map(clean)
    .filter(Boolean)
    .flatMap((p, para) => Array.from(segmenter.segment(p), (s) => ({ text: s.segment.trim(), para })).filter((s) => s.text));
}

// [muteParens · 2026-11-16 (2.ª versión)]: SÍ se lee lo que va entre paréntesis, pero los signos ( ) [ ] { } se cambian por espacios
// → la voz no dice «paréntesis» y el resaltado no cae sobre el signo de apertura · misma longitud: los índices del resaltado no se mueven | [Paradigma]: Funcional (pura)
export const muteParens = (text: string): string => text.replace(/[()[\]{}]/g, " ");

// [speakSymbols]: ahora vive en lib/speech (lo aplica `utterance` a toda voz) · se re-exporta para las pruebas
export { speakSymbols } from "@/lib/speech";

export interface PdfReaderProps {
  src?: string; // URL del PDF (BFF)
  text?: string; // [2026-11-16]: o un texto Markdown (temario del curso) → mismo lector sin PDF | `?` (TS): uno de los dos
  lang: string; // Idioma del curso, ISO 639-1 ("fr", "en"…)
  color: string; // Color del curso para el resaltado
  compact?: boolean; // [2026-11-16]: solo la barra de controles (sin tarjeta ni copia del texto) → el temario ya muestra el texto; evita el contenedor duplicado
  // [onSpeaking · 2026-11-16]: frase que suena (null = nada) y su palabra [inicio, fin) → el temario la resalta EN su propio texto (marcadores de lectura)
  onSpeaking?: (sentence: string | null, word: [number, number] | null) => void;
}

export function PdfReader({ src, text, lang, color, compact = false, onSpeaking }: PdfReaderProps) {
  const { t, locale } = usePreferences();
  const r = t.courses.materials.reader;
  // [Idioma destino]: siempre español; si el curso ya es de español, se traduce al inglés
  const target = lang === "es" ? "en" : "es";
  // `Intl.DisplayNames` (ES2021): nombre del idioma destino en el idioma de la interfaz ("español", "Spanish")
  const displayNames = useMemo(() => new Intl.DisplayNames([locale], { type: "language" }), [locale]);
  const targetName = displayNames.of(target) ?? target;
  const courseName = displayNames.of(lang) ?? lang;

  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [load, setLoad] = useState<LoadState>("loading");
  const [ocr, setOcr] = useState<{ page: number; total: number } | null>(null); // [Sprint 2.5]: progreso del OCR de un PDF escaneado
  const [step, setStep] = useState(-1); // [2026-10-28]: posición en la cola de voz (-1 = ninguna) → la frase activa se deriva
  const [word, setWord] = useState<[number, number] | null>(null); // Rango [inicio, fin) de la palabra leída, relativo a la FRASE
  const [play, setPlay] = useState<PlayState>("idle");
  const [rate, setRate] = useState(1);
  const rateRef = useRef(1); // Espejo de `rate` → las frases encadenadas (callbacks antiguos) usan la velocidad vigente
  const [showTr, setShowTr] = useState(false); // Traducción completa visible
  const [trAvailable, setTrAvailable] = useState<boolean | null>(null); // null = aún no comprobado
  const [paraTr, setParaTr] = useState<Record<number, string>>({}); // [Cache]: índice de párrafo → traducción
  const [sel, setSel] = useState<SelectionTr | null>(null); // Popover de la selección (frase o párrafo)
  const [card, setCard] = useState<WordTarget | null>(null); // [2026-10-28]: tarjeta de palabra (IPA + traducción + Aprender)
  const runRef = useRef(0); // [Token de ejecución]: invalida los callbacks de lecturas canceladas | `useRef` (React): valor mutable sin re-render
  const translatorRef = useRef<Promise<BrowserTranslator | null> | null>(null);
  const activeRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const vocab = useMarkedWords(lang); // [Aprender/Aprendido]: palabras del banco del usuario en el idioma del curso

  const hasTts = useSyncExternalStore(noopSubscribe, () => "speechSynthesis" in window, () => true);
  // [¿Hay voz del idioma?]: si no, el navegador usa la predeterminada (se avisa al usuario)
  const hasVoice = useSyncExternalStore(
    subscribeVoices,
    () => !("speechSynthesis" in window) || speechSynthesis.getVoices().length === 0 || Boolean(pickVoice(lang)),
    () => true,
  );

  // [Trozos por idioma + tokens]: `useMemo` → se calcula una vez por PDF | `others`: el idioma de las explicaciones (español; en cursos de español, el inglés)
  const rich = useMemo<RichChunk[][]>(() => {
    const others = lang === "es" ? ["en"] : ["es"];
    const seg = new Intl.Segmenter(lang, { granularity: "word" });
    const base = sentences.map((s) => splitByLanguage(s.text, lang, others));
    // [2026-11-16]: palabras del curso dentro de la explicación («Usamos always para…») → azul y voz del curso; `vocab` = lo que la ficha ya usa en el idioma del curso
    const vocab = courseVocab(base.flatMap((chunks, i) => chunks.filter((c) => c.speak).map((c) => sentences[i]!.text.slice(c.start, c.end))), lang, others);
    return sentences.map((s, i) => {
      const tokens: Token[] = Array.from(seg.segment(s.text), (x) => ({ text: x.segment, start: x.index, word: Boolean(x.isWordLike) }));
      return markCourseWords(s.text, base[i]!, lang, vocab).map((c) => ({ ...c, tokens: tokens.filter((tk) => tk.start >= c.start && tk.start < c.end) }));
    });
  }, [sentences, lang]);

  // [Cola de voz · 2026-11-16]: TODOS los trozos en orden, cada uno con la voz de SU idioma (inglés con voz inglesa, español con voz española…) | antes se saltaba lo que no era del idioma del curso
  const queue = useMemo<SpeechStep[]>(() => rich.flatMap((chunks, i) => chunks.map((_, ci) => ({ i, c: ci }))), [rich]);
  // [voiceLang]: idioma de la voz de un trozo (indeciso → idioma del curso)
  const voiceLang = (c: LangChunk) => (c.lang === UNDETERMINED ? lang : c.lang);
  // [Bilingüe · 2026-11-16]: ¿hay texto en otro idioma además del del curso? → la traducción completa ya está en el propio texto y se bloquea | `useMemo`: una vez por texto
  const otherLangs = useMemo(() => [...new Set(rich.flat().filter((c) => !c.speak && c.lang !== UNDETERMINED).map((c) => c.lang))], [rich]);
  const bilingual = otherLangs.length > 0;
  const active = queue[step]?.i ?? -1; // Frase que se está leyendo (derivada)
  const activeText = active >= 0 && play !== "idle" ? (sentences[active]?.text ?? null) : null;
  // [Aviso al contenedor]: `useEffect` (React) → el temario pinta los marcadores en su texto cada vez que cambia la frase o la palabra
  useEffect(() => onSpeaking?.(activeText, activeText ? word : null), [activeText, word, onSpeaking]);
  // [Primera palabra]: única con tabIndex=0 al empezar (roving tabindex: el resto -1 → una sola parada de Tab para todo el texto)
  const firstWord = useMemo(() => {
    for (const [i, chunks] of rich.entries()) for (const c of chunks) if (c.speak) for (const tk of c.tokens) if (tk.word) return wordKey(i, tk.start);
    return "";
  }, [rich]);

  // [Párrafos]: agrupa frases conservando su índice global | `useMemo` (React): solo al cambiar el texto
  const paragraphs = useMemo(() => {
    const out: Array<Array<{ s: Sentence; i: number }>> = [];
    sentences.forEach((s, i) => (out[s.para] ??= []).push({ s, i }));
    return out.filter(Boolean);
  }, [sentences]);

  // [Extracción]: al cambiar de PDF o de texto; el cleanup cancela la lectura en curso (evita voz "huérfana" al salir de la lección)
  useEffect(() => {
    let cancelled = false;
    // [2026-11-16]: con `text` (temario) no hay PDF que extraer → frases directas | `Promise.resolve` (ES2015): mismo flujo then/catch
    const job = text !== undefined ? Promise.resolve(textSentences(text, lang)) : extractSentences(src ?? "", lang, (page, total) => !cancelled && setOcr({ page, total }));
    job
      .then((s) => !cancelled && (setSentences(s), setLoad("ready"), setOcr(null))) // Operador coma: varios setState en una expresión
      .catch(() => !cancelled && setLoad("error"));
    return () => {
      cancelled = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps -- runRef es un contador (no un nodo DOM): incrementarlo invalida los callbacks de voz pendientes
      runRef.current++;
      if ("speechSynthesis" in window) speechSynthesis.cancel();
    };
  }, [src, text, lang]);

  // [Auto-scroll]: mantiene visible la frase leída dentro del panel
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [active]);

  // [Traductor perezoso]: se crea una sola vez, en el primer gesto del usuario que lo necesita | [Patrón]: Lazy Singleton
  const getTranslator = async () => {
    translatorRef.current ??= createTranslator(lang, target);
    const tr = await translatorRef.current;
    setTrAvailable(tr !== null);
    return tr;
  };

  // [Traducción completa]: párrafo a párrafo, en orden, sin repetir los ya traducidos (setState dentro de la promesa, no síncrono)
  useEffect(() => {
    if (!showTr || !trAvailable) return;
    let cancelled = false;
    void (async () => {
      const tr = await translatorRef.current;
      // `entries()` (ES2015): [índice, párrafo] | `for…of` secuencial → un párrafo a la vez
      for (const [pi, p] of paragraphs.entries()) {
        if (cancelled || !tr) return;
        const text = p.map(({ s }) => s.text).join(" ");
        const out = await tr.translate(text).catch(() => null);
        if (!cancelled && out) setParaTr((prev) => (pi in prev ? prev : { ...prev, [pi]: out }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showTr, trAvailable, paragraphs]);

  // [Popovers abiertos]: Escape o scroll los cierran (quedan desanclados del texto) | listeners con cleanup
  // [2026-10-28]: el scroll DENTRO de la tarjeta de palabra (hoja inferior en móvil) no la cierra
  useEffect(() => {
    if (!sel && !card) return;
    const close = (e: Event) => {
      if (e.target instanceof Node && (e.target as Element).closest?.("[data-word-card]")) return;
      setSel(null);
      setCard(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSel(null); // La tarjeta gestiona su propio Escape (y devuelve el foco)
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, { passive: true, capture: true }); // `capture`: también el scroll del panel de texto
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, { capture: true });
    };
  }, [sel, card]);

  // [openWord]: abre la tarjeta de una palabra (pulsada, seleccionada o con Enter) | cierra el popover de frase
  const openWord = (raw: string, i: number, el: HTMLElement | null, rect: DOMRect) => {
    const w = raw.trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").slice(0, MAX_WORD); // Sin signos al borde («farm,» → «farm»)
    if (!w) return;
    setSel(null);
    setCard({ word: w, i, el, rect });
  };

  // [Selección]: al soltar el puntero; UNA palabra → tarjeta de palabra · varias → popover de traducción | Selection API (DOM)
  const onPointerUp = async () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim().slice(0, MAX_SELECTION);
    if (!text || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect(); // Posición de la selección en el viewport
    if (!/\s/.test(text) && text.length <= MAX_WORD) {
      const host = (range.startContainer.parentElement?.closest("[data-wi]") as HTMLElement | null) ?? null;
      return openWord(text, Number(host?.dataset.wi?.split(":")[0] ?? Math.max(active, 0)), host, rect);
    }
    setCard(null);
    const x = Math.min(Math.max(rect.left + rect.width / 2 - POPOVER_W / 2, 8), window.innerWidth - POPOVER_W - 8); // `Math.min/max`: dentro de la pantalla
    setSel({ text, x, y: rect.bottom + 8 });
    const tr = await getTranslator();
    const out = tr ? await tr.translate(text).catch(() => null) : null;
    setSel((cur) => (cur?.text === text ? { ...cur, out } : cur)); // Solo si sigue siendo la misma selección
  };

  // [Clic en palabra]: delegación → `closest("[data-wi]")` | con texto seleccionado lo resuelve onPointerUp
  const onTextClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (window.getSelection()?.toString().trim()) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-wi]");
    if (el) openWord(el.textContent ?? "", Number(el.dataset.wi!.split(":")[0]), el, el.getBoundingClientRect());
  };

  // [Teclado · roving tabindex]: ←/→ palabra anterior/siguiente · Inicio/Fin · Enter/Espacio abre la tarjeta | patrón WAI-ARIA «composite widget»
  const onTextKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-wi]");
    if (!el || !textRef.current) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      return openWord(el.textContent ?? "", Number(el.dataset.wi!.split(":")[0]), el, el.getBoundingClientRect());
    }
    const all = Array.from(textRef.current.querySelectorAll<HTMLElement>("[data-wi]"));
    const at = all.indexOf(el);
    const to = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: all.length - 1 }[e.key];
    if (to === undefined || !all[to]) return;
    e.preventDefault();
    el.tabIndex = -1; // Imperativo a propósito: mover el foco no re-renderiza miles de palabras
    all[to].tabIndex = 0;
    all[to].focus();
  };

  // [utterance]: voz del idioma indicado (por defecto el del curso) a la velocidad elegida (helper compartido en lib/speech)
  const utterance = (text: string, voice = lang, cancel = true) => makeUtterance(text, voice, rateRef.current, cancel);

  function stop() {
    runRef.current++;
    speechSynthesis.cancel();
    setPlay("idle");
    setWord(null);
  }

  // [say]: lee el paso q de la cola (un trozo en el idioma del curso) y encadena el siguiente | trozo a trozo → evita el corte de Chrome y permite resaltar
  const say = (q: number): void => {
    const st = queue[q];
    if (!st) return stop();
    const chunk = rich[st.i]![st.c]!;
    const raw = muteParens(sentences[st.i]!.text).slice(chunk.start, chunk.end); // [2026-11-16]: sin pronunciar los signos de paréntesis
    if (!raw.trim()) return say(q + 1); // Trozo que era solo signos → siguiente
    const lead = raw.length - raw.trimStart().length; // Espacios iniciales → desplazamiento del resaltado
    const text = raw.trim();
    const offset = chunk.start + lead;
    const run = ++runRef.current; // Nueva ejecución → los callbacks anteriores quedan obsoletos
    const u = utterance(text, voiceLang(chunk)); // [2026-11-16]: voz del idioma del trozo · «=» dicho con palabras
    // [onboundary]: el motor avisa cada palabra (charIndex relativo al trozo) → se pasa a coordenadas de la FRASE
    u.onboundary = (e) => {
      if (run !== runRef.current || e.name !== "word") return;
      const len = e.charLength || (/^\S+/.exec(text.slice(e.charIndex))?.[0].length ?? 0); // Algunas voces no envían charLength
      setWord([offset + e.charIndex, offset + e.charIndex + len]);
    };
    u.onend = () => run === runRef.current && say(q + 1);
    u.onerror = () => run === runRef.current && stop();
    setStep(q);
    setWord(null);
    setPlay("playing");
    speechSynthesis.speak(u);
  };

  // [sayFrom]: primer paso de la cola en la frase i o después (las frases solo en español se saltan)
  const sayFrom = (i: number) => {
    const q = queue.findIndex((s) => s.i >= i);
    if (q !== -1) say(q);
  };

  // [Escuchar selección · 2026-11-16]: cada trozo con la voz de su idioma (speechSynthesis encola las locuciones en orden)
  const listen = (text: string) => {
    stop();
    for (const c of splitByLanguage(text, lang, lang === "es" ? ["en"] : ["es"])) {
      const part = muteParens(text).slice(c.start, c.end).trim();
      if (part) speechSynthesis.speak(utterance(part, voiceLang(c), false)); // `false`: se encolan (stop() ya canceló lo anterior)
    }
  };

  // [Play/Pausa]: máquina de estados idle → playing ⇄ paused
  const onPlayPause = () => {
    if (play === "playing") {
      speechSynthesis.pause();
      setPlay("paused");
    } else if (play === "paused") {
      speechSynthesis.resume();
      setPlay("playing");
    } else say(Math.max(0, step));
  };

  // [Traducir todo]: el click es el gesto que permite descargar el modelo de traducción
  const onToggleTranslate = async () => {
    if (showTr) return setShowTr(false);
    setShowTr(true);
    await getTranslator();
  };

  const fullText = useMemo(() => sentences.map((s) => s.text).join(" "), [sentences]);
  // [Tinta del idioma del curso]: color del curso mezclado con el texto → resaltado legible en claro y oscuro | `color-mix` (CSS Color 5)
  const inkStyle = { "--reader-ink": `color-mix(in oklab, ${color} 55%, var(--nl-txt))` } as CSSProperties;

  return (
    // `cn` (clsx + tailwind-merge): en modo compacto, franja integrada en la tarjeta del temario en vez de otra tarjeta
    <section aria-labelledby="reader-title" className={cn("space-y-3", compact ? "border-y border-border py-3" : "surface p-4")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="reader-title" className="title-card">
          {r.title}
        </h3>
        {load === "ready" && sentences.length > 0 && (
          // [Controles]: `role="group"` agrupa los botones para lectores de pantalla
          <div role="group" aria-label={r.title} className="flex flex-wrap items-center gap-2">
            {hasTts && (
              <>
                <button type="button" onClick={onPlayPause} disabled={!queue.length} className="btn btn-primary btn-sm" aria-pressed={play === "playing"}>
                  {play === "playing" ? r.pause : play === "paused" ? r.resume : r.play}
                </button>
                <button type="button" onClick={stop} disabled={play === "idle"} className="btn btn-outline btn-sm">
                  {r.stop}
                </button>
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  {r.speed}
                  <select value={rate} onChange={(e) => setRate((rateRef.current = Number(e.target.value)))} className="rounded border border-border bg-transparent px-1 py-0.5 text-xs">
                    {RATES.map((v) => (
                      <option key={v} value={v}>
                        {v}×
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {/* [2026-11-16]: texto ya bilingüe → sin botón de traducción (la traducción está en el propio texto, marcada por color); un solo idioma → botón */}
            {!bilingual && (
              <button type="button" onClick={() => void onToggleTranslate()} aria-pressed={showTr} className="btn btn-outline btn-sm">
                {showTr ? r.translateOff : fmt(r.translateAll, { lang: targetName })}
              </button>
            )}
          </div>
        )}
      </div>

      {load === "loading" && <p className="type-meta text-muted-foreground" role="status">{ocr ? fmt(r.ocr, { page: ocr.page, total: ocr.total }) : text !== undefined ? r.textLoading : r.loading}</p>}
      {/* [2026-11-16]: sin aviso «El texto ya está en dos idiomas…» → los marcadores de color por idioma ya lo muestran */}
      {load === "error" && <p className="type-meta text-tone-danger" role="alert">{r.loadError}</p>}
      {load === "ready" && sentences.length === 0 && <p className="type-meta text-muted-foreground">{r.noText}</p>}
      {load === "ready" && !hasTts && <p className="type-meta text-muted-foreground">{r.noTts}</p>}
      {load === "ready" && hasTts && !hasVoice && <p className="type-meta text-muted-foreground">{r.noVoice}</p>}
      {/* [Sin traductor integrado]: aviso + enlace opcional a Google Translate con el texto */}
      {showTr && trAvailable === false && (
        <p role="alert" className="type-meta text-muted-foreground">
          {r.translateUnavailable}{" "}
          <a href={googleTranslateUrl(lang, target, fullText)} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
            {r.openTranslate}
          </a>
        </p>
      )}

      {/* [Compacto]: la frase que suena (aria-live → el lector de pantalla la anuncia) y, si se pidió, la traducción por párrafo */}
      {compact && !onSpeaking && active >= 0 && (
        // [2026-11-16 · Marcadores de lectura en el temario]: la frase que suena con los MISMOS marcadores que el lector completo → idioma del curso en su color,
        // otros idiomas en gris y la palabra que se pronuncia resaltada (<mark>, no solo color: WCAG 1.4.1)
        <p aria-live="polite" className="type-meta rounded-md px-2 py-1" style={{ ...inkStyle, background: `${color}1f` }}>
          {rich[active]?.map((c, ci) => (
            <span key={ci} lang={c.lang === UNDETERMINED ? undefined : c.lang} className={c.speak ? "font-medium text-[var(--reader-ink)]" : "text-muted-foreground"}>
              {c.tokens.map((tk) =>
                word !== null && tk.word && tk.start < word[1] && tk.start + tk.text.length > word[0] ? (
                  <mark key={tk.start} className="rounded-sm bg-amber-200/80 px-0.5 font-semibold text-foreground underline decoration-2 underline-offset-4 dark:bg-amber-400/30">{tk.text}</mark>
                ) : (
                  tk.text
                ),
              )}
            </span>
          ))}
        </p>
      )}
      {/* [Leyenda compacta]: qué significa cada color (igual que el lector completo) */}
      {compact && sentences.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 type-meta text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block size-2.5 rounded-full" style={{ background: color }} /> {courseName}
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block size-2.5 rounded-full bg-muted-foreground/40" /> Otros idiomas (con su propia voz)
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block size-2.5 rounded-sm bg-amber-300" /> Palabra que se lee{onSpeaking ? " (resaltada en el texto)" : ""}
          </span>
        </p>
      )}
      {compact && showTr && trAvailable && (
        <div lang={target} className="max-h-[40vh] space-y-1 overflow-y-auto border-l-2 pl-2 type-meta italic text-muted-foreground" style={{ borderColor: color }}>
          {paragraphs.map((_, pi) => (
            <p key={pi}>{paraTr[pi] ?? r.translating}</p>
          ))}
        </div>
      )}

      {!compact && sentences.length > 0 && (
        <>
          {/* [Ayuda + leyenda]: qué se lee y cómo se usa el texto | id → aria-describedby del panel */}
          <div id="reader-help" className="flex flex-wrap items-center gap-x-4 gap-y-1 type-meta text-muted-foreground">
            <span>Pulsa una palabra para ver su pronunciación, traducción y guardarla · selecciona varias para traducir la frase · ←/→ recorre las palabras con el teclado.</span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block size-2.5 rounded-full" style={{ background: color }} /> {courseName}: se lee en voz alta
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block size-2.5 rounded-full bg-muted-foreground/40" /> Otros idiomas en gris: se leen con su propia voz
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block size-2.5 rounded-sm bg-amber-300" /> En repaso
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block size-2.5 rounded-sm bg-emerald-400" /> Ya la sé
            </span>
          </div>
          {/* [Texto leíble]: `lang` por trozo (HTML) → pronunciación correcta en lectores de pantalla | delegación de eventos: clic, teclado y selección */}
          <div
            ref={textRef}
            aria-label={r.textLabel}
            aria-describedby="reader-help"
            onPointerUp={() => void onPointerUp()}
            onClick={onTextClick}
            onKeyDown={onTextKeyDown}
            style={inkStyle}
            className="max-h-[55vh] select-text overflow-y-auto rounded-lg border border-border bg-[var(--nl-surf)] p-4 text-[15px] leading-loose"
          >
            {paragraphs.map((p, pi) => (
              <div key={p[0].i} className={cn("mb-2 last:mb-0", /^(ejercicio|exercise|ficha|parte|part)\b/i.test(p[0].s.text) && "mt-5 border-t border-border pt-3 font-semibold first:mt-0 first:border-t-0 first:pt-0")}>
                <p>
                  {p.map(({ i }) => {
                    const isActive = i === active;
                    return (
                      // [Frase]: fondo suave mientras se lee | los trozos en el idioma del curso llevan su «tinta» de color; los demás, atenuados en cursiva
                      <span key={i} ref={isActive ? activeRef : undefined} className="rounded px-0.5 transition-colors" style={isActive ? { background: `${color}1f` } : undefined}>
                        {rich[i]?.map((c, ci) => (
                          <span key={ci} lang={c.lang === UNDETERMINED ? undefined : c.lang} className={c.speak ? "font-medium text-[var(--reader-ink)]" : "text-muted-foreground"}>
                            {c.tokens.map((tk) => {
                              if (!tk.word || !c.speak) return tk.text;
                              const key = wordKey(i, tk.start);
                              const reading = isActive && word !== null && tk.start < word[1] && tk.start + tk.text.length > word[0];
                              const status = vocab.words.get(termKey(tk.text))?.status ?? null;
                              return (
                                // [Palabra pulsable]: role="button" + aria-haspopup="dialog" → el lector anuncia que abre la tarjeta | tabIndex roving
                                <span
                                  key={key}
                                  data-wi={key}
                                  role="button"
                                  aria-haspopup="dialog"
                                  tabIndex={key === firstWord ? 0 : -1}
                                  title={status === "learning" ? "En repaso" : status === "learned" ? "Ya la sé" : undefined}
                                  className={cn(
                                    "cursor-pointer rounded-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                    // [Resaltado · 2026-10-30]: fondo suave como la referencia (docs/WhatsApp Image…) + subrayado distinto → el estado no depende solo del color (WCAG 1.4.1)
                                    status === "learning" && "bg-amber-200/70 px-0.5 underline decoration-dotted decoration-2 underline-offset-4 dark:bg-amber-400/25",
                                    status === "learned" && "bg-emerald-200/60 px-0.5 underline decoration-1 underline-offset-4 dark:bg-emerald-400/20",
                                    card?.el?.dataset.wi === key && "bg-amber-200/70 px-0.5 dark:bg-amber-400/25",
                                  )}
                                  style={reading ? { background: color, color: "#fff" } : status ? { textDecorationColor: color } : undefined}
                                >
                                  {tk.text}
                                </span>
                              );
                            })}
                          </span>
                        ))}{" "}
                      </span>
                    );
                  })}
                </p>
                {/* [Traducción interlineal]: debajo de cada párrafo, en el idioma destino */}
                {showTr && trAvailable && (
                  <p lang={target} className="mt-1 border-l-2 pl-2 type-meta italic text-muted-foreground" style={{ borderColor: color }}>
                    {paraTr[pi] ?? r.translating}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* [Tarjeta de palabra · 2026-10-28]: IPA + traducción + 🔊 + Aprender/Aprendido | `key`: palabra nueva → estado nuevo */}
      {card && createPortal(
        <div data-word-card>
          <WordCard
            key={`${card.word}-${card.i}`}
            word={card.word}
            sentence={sentences[card.i]?.text}
            lang={lang}
            anchor={card.rect}
            returnFocus={card.el}
            marked={vocab.words.get(termKey(card.word))}
            busy={vocab.busy}
            saveError={vocab.error}
            onStatus={(status, translation) => void vocab.setStatus(card.word, status, { translation, sentence: sentences[card.i]?.text })}
            onReadFrom={hasTts && queue.length ? () => (setCard(null), sayFrom(card.i)) : undefined}
            onClose={() => setCard(null)}
          />
        </div>,
        document.body,
      )}

      {/* [Popover de selección]: `position: fixed` bajo la selección | role="dialog" no modal + aria-live para anunciar la traducción */}
      {sel && createPortal(
        <div
          role="dialog"
          aria-label={r.selection}
          className="surface fixed z-50 space-y-2 p-3 text-xs shadow-lg"
          style={{ left: sel.x, top: sel.y, width: POPOVER_W, maxWidth: "calc(100vw - 16px)" }}
        >
          <div className="flex items-start justify-between gap-2">
            <p lang={lang} className="line-clamp-3 font-semibold">
              {sel.text}
            </p>
            <button type="button" onClick={() => setSel(null)} aria-label={r.close} className="btn btn-ghost btn-sm px-2!">
              ✕
            </button>
          </div>
          <p aria-live="polite" lang={target} className="rounded border-l-2 pl-2" style={{ borderColor: color }}>
            {sel.out === undefined ? (
              r.translating
            ) : sel.out === null ? (
              <a href={googleTranslateUrl(lang, target, sel.text)} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                {r.openTranslate}
              </a>
            ) : (
              sel.out
            )}
          </p>
          {hasTts && sel.text.trim() && (
            <button type="button" onClick={() => listen(sel.text)} className="btn btn-outline btn-sm">
              {r.listen}
            </button>
          )}
        </div>,
        document.body,
      )}
    </section>
  );
}

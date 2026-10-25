"use client"; // [Next.js]: Client Component → usa APIs del navegador (Web Speech, Translator, Selection, Web Worker)
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePreferences } from "@/components/layout/PreferencesProvider";
import { fmt } from "@aula/shared-i18n";
import { pdfText, pdfOcrText } from "@/lib/pdf-text";
import { pickVoice, utterance as makeUtterance } from "@/lib/speech"; // [DRY]: misma selección de voz que las fichas de vocabulario
// [PdfReader]: lectura en voz alta del texto del PDF con resaltado de frase + palabra, traducción completa al español (párrafo a párrafo) y traducción de la selección (palabra o párrafo)
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
  return raw
    .replace(/-\n(?=\p{Ll})/gu, "") // Une palabras cortadas con guion al final de línea | `\p{Ll}` + flag `u`: minúscula Unicode
    .split(/\n\s*\n/) // Línea en blanco = nuevo párrafo
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    // `flatMap` (ES2019) + `Array.from(iterable, map)`: párrafos → frases con su índice de párrafo
    .flatMap((p, para) => Array.from(segmenter.segment(p), (s) => ({ text: s.segment.trim(), para })).filter((s) => s.text));
}

// [serverTranslator · Sprint 2.5]: navegadores sin Translator API (Firefox, Safari…) traducen con el servicio de la plataforma
// (BFF → NestJS → FastAPI /language-tools/translate, LLM local) en trozos de ≤ 500 caracteres (límite del servicio) | [Patrón]: Adapter (mismo contrato BrowserTranslator)
function serverTranslator(source: string, target: string): BrowserTranslator {
  const one = async (text: string) => {
    const res = await fetch("/api/vocabulary/lookup/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, source, target }) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return ((await res.json()) as { translation: string }).translation;
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

export interface PdfReaderProps {
  src: string; // URL del PDF (BFF)
  lang: string; // Idioma del curso, ISO 639-1 ("fr", "en"…)
  color: string; // Color del curso para el resaltado
}

export function PdfReader({ src, lang, color }: PdfReaderProps) {
  const { t, locale } = usePreferences();
  const r = t.courses.materials.reader;
  // [Idioma destino]: siempre español; si el curso ya es de español, se traduce al inglés
  const target = lang === "es" ? "en" : "es";
  // `Intl.DisplayNames` (ES2021): nombre del idioma destino en el idioma de la interfaz ("español", "Spanish")
  const targetName = useMemo(() => new Intl.DisplayNames([locale], { type: "language" }).of(target) ?? target, [locale, target]);

  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [load, setLoad] = useState<LoadState>("loading");
  const [ocr, setOcr] = useState<{ page: number; total: number } | null>(null); // [Sprint 2.5]: progreso del OCR de un PDF escaneado
  const [active, setActive] = useState(-1); // Frase que se está leyendo (-1 = ninguna)
  const [word, setWord] = useState<[number, number] | null>(null); // Rango [inicio, fin) de la palabra leída dentro de la frase
  const [play, setPlay] = useState<PlayState>("idle");
  const [rate, setRate] = useState(1);
  const rateRef = useRef(1); // Espejo de `rate` → las frases encadenadas (callbacks antiguos) usan la velocidad vigente
  const [showTr, setShowTr] = useState(false); // Traducción completa visible
  const [trAvailable, setTrAvailable] = useState<boolean | null>(null); // null = aún no comprobado
  const [paraTr, setParaTr] = useState<Record<number, string>>({}); // [Cache]: índice de párrafo → traducción
  const [sel, setSel] = useState<SelectionTr | null>(null); // Popover de la selección
  const runRef = useRef(0); // [Token de ejecución]: invalida los callbacks de lecturas canceladas | `useRef` (React): valor mutable sin re-render
  const translatorRef = useRef<Promise<BrowserTranslator | null> | null>(null);
  const activeRef = useRef<HTMLSpanElement>(null);

  const hasTts = useSyncExternalStore(noopSubscribe, () => "speechSynthesis" in window, () => true);
  // [¿Hay voz del idioma?]: si no, el navegador usa la predeterminada (se avisa al usuario)
  const hasVoice = useSyncExternalStore(
    subscribeVoices,
    () => !("speechSynthesis" in window) || speechSynthesis.getVoices().length === 0 || Boolean(pickVoice(lang)),
    () => true,
  );

  // [Párrafos]: agrupa frases conservando su índice global | `useMemo` (React): solo al cambiar el texto
  const paragraphs = useMemo(() => {
    const out: Array<Array<{ s: Sentence; i: number }>> = [];
    sentences.forEach((s, i) => (out[s.para] ??= []).push({ s, i }));
    return out.filter(Boolean);
  }, [sentences]);

  // [Extracción]: al cambiar de PDF; el cleanup cancela la lectura en curso (evita voz "huérfana" al salir de la lección)
  useEffect(() => {
    let cancelled = false;
    extractSentences(src, lang, (page, total) => !cancelled && setOcr({ page, total }))
      .then((s) => !cancelled && (setSentences(s), setLoad("ready"), setOcr(null))) // Operador coma: varios setState en una expresión
      .catch(() => !cancelled && setLoad("error"));
    return () => {
      cancelled = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps -- runRef es un contador (no un nodo DOM): incrementarlo invalida los callbacks de voz pendientes
      runRef.current++;
      if ("speechSynthesis" in window) speechSynthesis.cancel();
    };
  }, [src, lang]);

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

  // [Popover abierto]: Escape o scroll lo cierran (queda desanclado de la selección) | listeners con cleanup
  useEffect(() => {
    if (!sel) return;
    const close = () => setSel(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, { passive: true, capture: true }); // `capture`: también el scroll del panel de texto
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, { capture: true });
    };
  }, [sel]);

  // [Traducir selección]: al soltar el puntero sobre el texto; palabra o párrafo seleccionado → popover con la traducción | Selection API (DOM)
  const onPointerUp = async () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim().slice(0, MAX_SELECTION);
    if (!text || !selection?.rangeCount) return;
    const rect = selection.getRangeAt(0).getBoundingClientRect(); // Posición de la selección en el viewport
    const x = Math.min(Math.max(rect.left + rect.width / 2 - POPOVER_W / 2, 8), window.innerWidth - POPOVER_W - 8); // `Math.min/max`: dentro de la pantalla
    setSel({ text, x, y: rect.bottom + 8 });
    const tr = await getTranslator();
    const out = tr ? await tr.translate(text).catch(() => null) : null;
    setSel((cur) => (cur?.text === text ? { ...cur, out } : cur)); // Solo si sigue siendo la misma selección
  };

  // [say]: lee la frase i y encadena la siguiente al terminar | frase a frase → evita el corte de Chrome en textos largos y permite resaltar
  const say = (i: number): void => {
    if (i >= sentences.length) return stop();
    const run = ++runRef.current; // Nueva ejecución → los callbacks anteriores quedan obsoletos
    const text = sentences[i].text;
    const u = utterance(text);
    // [onboundary]: el motor avisa cada palabra (charIndex) → resaltado sincronizado con el audio
    u.onboundary = (e) => {
      if (run !== runRef.current || e.name !== "word") return;
      const len = e.charLength || (/^\S+/.exec(text.slice(e.charIndex))?.[0].length ?? 0); // Algunas voces no envían charLength
      setWord([e.charIndex, e.charIndex + len]);
    };
    u.onend = () => run === runRef.current && say(i + 1);
    u.onerror = () => run === runRef.current && stop();
    setActive(i);
    setWord(null);
    setPlay("playing");
    speechSynthesis.speak(u);
  };

  // [utterance]: voz del idioma del curso a la velocidad elegida (helper compartido en lib/speech)
  const utterance = (text: string) => makeUtterance(text, lang, rateRef.current);

  function stop() {
    runRef.current++;
    speechSynthesis.cancel();
    setPlay("idle");
    setWord(null);
  }

  // [Escuchar selección]: pronuncia solo la palabra/párrafo seleccionado
  const listen = (text: string) => {
    stop();
    speechSynthesis.speak(utterance(text));
  };

  // [Play/Pausa]: máquina de estados idle → playing ⇄ paused
  const onPlayPause = () => {
    if (play === "playing") {
      speechSynthesis.pause();
      setPlay("paused");
    } else if (play === "paused") {
      speechSynthesis.resume();
      setPlay("playing");
    } else say(Math.max(0, active));
  };

  // [Traducir todo]: el click es el gesto que permite descargar el modelo de traducción
  const onToggleTranslate = async () => {
    if (showTr) return setShowTr(false);
    setShowTr(true);
    await getTranslator();
  };

  const fullText = useMemo(() => sentences.map((s) => s.text).join(" "), [sentences]);

  return (
    <section aria-labelledby="reader-title" className="surface space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="reader-title" className="text-sm font-semibold">
          {r.title}
        </h3>
        {load === "ready" && sentences.length > 0 && (
          // [Controles]: `role="group"` agrupa los botones para lectores de pantalla
          <div role="group" aria-label={r.title} className="flex flex-wrap items-center gap-2">
            {hasTts && (
              <>
                <button type="button" onClick={onPlayPause} className="btn btn-primary btn-sm" aria-pressed={play === "playing"}>
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
            <button type="button" onClick={() => void onToggleTranslate()} aria-pressed={showTr} className="btn btn-outline btn-sm">
              {showTr ? r.translateOff : fmt(r.translateAll, { lang: targetName })}
            </button>
          </div>
        )}
      </div>

      {load === "loading" && <p className="text-xs text-muted-foreground" role="status">{ocr ? fmt(r.ocr, { page: ocr.page, total: ocr.total }) : r.loading}</p>}
      {load === "error" && <p className="text-xs text-tone-danger" role="alert">{r.loadError}</p>}
      {load === "ready" && sentences.length === 0 && <p className="text-xs text-muted-foreground">{r.noText}</p>}
      {load === "ready" && !hasTts && <p className="text-xs text-muted-foreground">{r.noTts}</p>}
      {load === "ready" && hasTts && !hasVoice && <p className="text-xs text-muted-foreground">{r.noVoice}</p>}
      {/* [Sin traductor integrado]: aviso + enlace opcional a Google Translate con el texto */}
      {showTr && trAvailable === false && (
        <p role="alert" className="text-xs text-muted-foreground">
          {r.translateUnavailable}{" "}
          <a href={googleTranslateUrl(lang, target, fullText)} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
            {r.openTranslate}
          </a>
        </p>
      )}

      {sentences.length > 0 && (
        <>
          <p className="text-[11px] text-muted-foreground">{r.hint}</p>
          {/* [Texto leíble]: `lang` (HTML) → pronunciación correcta en lectores de pantalla | onPointerUp → traducir selección (ratón y táctil) */}
          <div
            aria-label={r.textLabel}
            onPointerUp={() => void onPointerUp()}
            className="max-h-[55vh] select-text overflow-y-auto rounded-lg border border-border p-4 text-sm leading-relaxed"
          >
            {paragraphs.map((p, pi) => (
              <div key={p[0].i} className="mb-3 last:mb-0">
                <p lang={lang}>
                  {p.map(({ s, i }) => {
                    const isActive = i === active;
                    return (
                      // [Frase clicable]: <span> (no <button>) para que el texto se pueda seleccionar; el teclado usa los controles de arriba
                      <span
                        key={i}
                        ref={isActive ? activeRef : undefined}
                        onClick={() => hasTts && !window.getSelection()?.toString() && say(i)} // Con texto seleccionado se traduce, no se lee
                        className="cursor-pointer rounded px-0.5 transition-colors hover:bg-muted"
                        style={isActive ? { background: `${color}1f` } : undefined}
                      >
                        {/* [Resaltado de palabra]: <mark> (HTML semántico) sobre el rango que el motor está leyendo */}
                        {isActive && word ? (
                          <>
                            {s.text.slice(0, word[0])}
                            <mark className="rounded px-0.5 text-white" style={{ background: color }}>
                              {s.text.slice(word[0], word[1])}
                            </mark>
                            {s.text.slice(word[1])}
                          </>
                        ) : (
                          s.text
                        )}{" "}
                      </span>
                    );
                  })}
                </p>
                {/* [Traducción interlineal]: debajo de cada párrafo, en el idioma destino */}
                {showTr && trAvailable && (
                  <p lang={target} className="mt-1 border-l-2 pl-2 text-xs italic text-muted-foreground" style={{ borderColor: color }}>
                    {paraTr[pi] ?? r.translating}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* [Popover de selección]: `position: fixed` bajo la selección | role="dialog" no modal + aria-live para anunciar la traducción */}
      {sel && (
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
          {hasTts && (
            <button type="button" onClick={() => listen(sel.text)} className="btn btn-outline btn-sm">
              {r.listen}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

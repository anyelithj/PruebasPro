"use client"; // [Next.js]: Client Component → posición en pantalla, foco y consultas al diccionario
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Check, Play, X } from "lucide-react";
import { SpeakButton } from "@/components/curriculum/SpeakButton"; // [DRY]: mismo botón 🔊 (voz natural → audio del servidor → voz del navegador)
import { AccentSwitch } from "@/components/shared/AccentSwitch"; // [2026-10-31]: switch UK/US (inglés)
import { useAccent, useWordIpa, useWordLookup, termKey, type MarkedWord, type WordStatus } from "@/hooks/useVocabulary";
import { cn } from "@/lib/utils";
// [WordCard · 2026-10-30]: tarjeta de la referencia docs/WhatsApp Image 2026-10-30 → 🔊 palabra · IPA · traducción centradas + pie a dos colores «Aprendido» (verde) | «Aprender» (amarillo) + flecha que apunta a la palabra
// [Posición]: ENCIMA de la palabra (debajo si no cabe), también en móvil | `position: fixed` (CSS) + coordenadas del viewport
// [A11y]: role="dialog" (no modal) con nombre · el foco entra al abrir y VUELVE a la palabra al cerrar · Esc y clic fuera cierran · aria-live anuncia la traducción · aria-pressed + ✓ (el estado no depende solo del color, WCAG 1.4.1)
// [Patrón]: Presentational + Custom Hook (useWordLookup) + Popover | [Principio]: SRP + DRY | [Paradigma]: Reactivo + Declarativo

export interface WordCardProps {
  word: string;
  sentence?: string; // Frase de contexto → traducción según el contexto (y ejemplo al guardar)
  lang: string; // Idioma del curso (ISO 639-1)
  anchor: DOMRect; // Rectángulo de la palabra en el viewport
  returnFocus?: HTMLElement | null; // Elemento que recupera el foco al cerrar
  marked?: MarkedWord;
  busy?: boolean;
  saveError?: string | null;
  onStatus?: (status: WordStatus, translation?: string) => void; // Sin callback → sin botones (usuario sin banco de vocabulario)
  onReadFrom?: () => void; // «Leer desde aquí» (conserva la función anterior de pulsar una frase)
  onClose: () => void;
}

const CARD_W = 280; // Ancho máximo (px)
const GAP = 12; // Separación con la palabra: deja sitio a la flecha
const EDGE = 8; // Margen mínimo con el borde de la pantalla
const ARROW = 12; // Lado de la flecha (cuadrado girado 45°)

// [ipaLine · 2026-10-31]: variante del acento elegido (inglés) o la única del idioma | Función pura
const ipaLine = (uk: string | null | undefined, us: string | null | undefined, accent: "uk" | "us"): string | null => {
  const one = accent === "us" ? (us ?? uk) : (uk ?? us);
  return one ? (one.startsWith("/") || one.startsWith("[") ? one : `/${one}/`) : null;
};

// [Pie a dos colores]: mismas clases para ambos botones salvo el color | texto oscuro sobre fondo claro → contraste AA también en modo oscuro | [Patrón]: Lookup Table
const STATUS_BTN: ReadonlyArray<{ status: WordStatus; off: string; on: string; tone: string }> = [
  // [2026-11-06]: «Aprendido/Aprender» confundía → acción clara: «Ya la sé» (dominada) | «Repasar» (al mazo de repaso)
  { status: "learned", off: "Ya la sé", on: "La sé", tone: "bg-emerald-400 text-emerald-950 hover:bg-emerald-300" },
  { status: "learning", off: "Repasar", on: "En repaso", tone: "bg-amber-300 text-amber-950 hover:bg-amber-200" },
];

export function WordCard({ word, sentence, lang, anchor, returnFocus, marked, busy, saveError, onStatus, onReadFrom, onClose }: WordCardProps) {
  const { data, error, loading, retry } = useWordLookup(lang, word, sentence);
  const fast = useWordIpa(lang, word); // [Fix 2026-10-31]: IPA al instante; antes no se veía nada hasta que respondía la IA (de 5 a 50 s en CPU)
  const { accent } = useAccent();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId(); // `useId` (React 18): id estable para aria-labelledby
  const [pos, setPos] = useState<{ left: number; top: number; width: number; above: boolean } | null>(null);

  // [Posición]: `useLayoutEffect` (React) → se mide la tarjeta ANTES de pintar (sin salto visual) | encima si cabe; `Math.min/max`: siempre dentro de la pantalla
  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight ?? 180;
    const width = Math.min(CARD_W, window.innerWidth - EDGE * 2);
    const left = Math.min(Math.max(anchor.left + anchor.width / 2 - width / 2, EDGE), window.innerWidth - width - EDGE);
    const above = anchor.top - h - GAP >= EDGE;
    setPos({ left, width, above, top: above ? anchor.top - h - GAP : Math.min(anchor.bottom + GAP, window.innerHeight - h - EDGE) });
  }, [anchor, data, loading, saveError, fast]);

  // [Refs de callbacks]: el padre crea `onClose` en cada render → con un ref el efecto de foco corre UNA vez (si no, el cleanup devolvería el foco a la palabra en cada render)
  const closeRef = useRef(onClose);
  const returnRef = useRef(returnFocus);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // [Foco]: entra a la tarjeta al abrir y vuelve a la palabra al cerrar | Esc y clic fuera cierran | listeners con cleanup
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeRef.current();
    };
    window.addEventListener("keydown", onKey, { capture: true }); // `capture`: llega aunque la tarjeta detenga la propagación de sus teclas
    window.addEventListener("pointerdown", onDown, { capture: true }); // `capture`: antes que el clic en otra palabra (que abrirá otra tarjeta)
    const target = returnRef.current;
    return () => {
      window.removeEventListener("keydown", onKey, { capture: true });
      window.removeEventListener("pointerdown", onDown, { capture: true });
      target?.focus({ preventScroll: true }); // Devuelve el foco (WCAG 2.4.3 orden del foco)
    };
  }, []);

  const ipa = ipaLine(data?.ipa_uk ?? data?.ipa ?? fast?.ipa, data?.ipa_us ?? fast?.ipa_us, lang === "en" ? accent : "uk");
  const status = marked?.status ?? null;
  // [Flecha]: apunta al centro de la palabra; `Math.max/min` la mantiene sobre la tarjeta aunque esta se haya pegado al borde de la pantalla
  const arrowLeft = pos ? Math.max(ARROW, Math.min(anchor.left + anchor.width / 2 - pos.left, pos.width - ARROW)) : 0;
  // Encima de la palabra, la flecha sale del pie: toma el color del botón que tiene detrás (verde a la izquierda, amarillo a la derecha)
  const arrowTone = !pos?.above || !onStatus ? "bg-[var(--nl-surf)]" : arrowLeft < pos.width / 2 ? "bg-emerald-400" : "bg-amber-300";

  return (
    <div
      ref={ref}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1} // Foco programático (no entra en el orden de tabulación)
      onKeyDown={(e) => e.stopPropagation()} // Las flechas dentro de la tarjeta no mueven la palabra activa del texto
      className={cn("fixed z-50 rounded-2xl border border-border bg-[var(--nl-surf)] text-sm shadow-2xl outline-none fade-in", !pos && "invisible")} // Primer pintado sin medir → invisible un instante (sin salto)
      style={{ left: pos?.left ?? EDGE, top: pos?.top ?? EDGE, width: pos?.width ?? CARD_W }}
    >
      <button type="button" onClick={onClose} aria-label="Cerrar" className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <X aria-hidden className="size-4" />
      </button>

      <div className="space-y-1.5 px-8 pb-3 pt-4 text-center">
        <p className="flex items-center justify-center gap-2">
          <SpeakButton text={word} lang={lang} variant={lang === "en" ? (accent === "uk" ? "en-GB" : "en-US") : undefined} label={`Escuchar «${word}»`} size="md" />
          <span id={titleId} lang={lang} className="min-w-0 break-words text-xl font-medium leading-tight">
            {word}
          </span>
        </p>
        {lang === "en" && <AccentSwitch />}
        {/* [IPA + traducción]: aria-live → el lector anuncia el resultado cuando llega | rótulos visibles: qué es cada dato */}
        <div aria-live="polite" className="space-y-1">
          {ipa && (
            <p className="text-[13px] text-muted-foreground">
              <span className="block text-[10px] font-semibold uppercase tracking-wide">Pronunciación (IPA)</span>
              <span className="eeg-mono">{ipa}</span>
            </p>
          )}
          {data?.lemma && termKey(data.lemma) !== termKey(word) && (
            <p className="type-meta text-muted-foreground">
              Forma base: <span lang={lang}>{data.lemma}</span>
            </p>
          )}
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Traducción al español</span>
          {loading && <p className="type-meta animate-pulse text-muted-foreground">Traduciendo…</p>}
          {error && <p className="type-meta text-tone-danger">{error}</p>}
          {data?.translation && (
            <p lang="es" className="text-lg leading-snug">
              {data.translation}
            </p>
          )}
          {/* [Sin respuesta de la IA]: se dice y se puede volver a pedir, sin cerrar la ficha */}
          {!loading && !data?.translation && (
            <p className="type-meta text-muted-foreground">
              {!error && "Traducción no disponible ahora. "}
              <button type="button" onClick={retry} className="font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Reintentar
              </button>
            </p>
          )}
        </div>
        {onReadFrom && (
          <button type="button" onClick={onReadFrom} className="inline-flex items-center gap-1 rounded-sm text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Play aria-hidden className="size-3" /> Leer desde aquí
          </button>
        )}
        {saveError && (
          <p role="alert" className="type-meta text-tone-danger">
            {saveError}
          </p>
        )}
      </div>

      {/* [Acciones]: «Aprendido» | «Aprender» (al mazo de repaso) | `grid-cols-2` (Tailwind): mitades iguales | `overflow-hidden` + `rounded-b-2xl`: el pie sigue la curva de la tarjeta */}
      {onStatus && (
        <div className="grid grid-cols-2 overflow-hidden rounded-b-2xl">
          {STATUS_BTN.map((b) => (
            <button
              key={b.status}
              type="button"
              disabled={busy}
              aria-pressed={status === b.status}
              onClick={() => onStatus(b.status, data?.translation)}
              className={cn("inline-flex min-h-11 items-center justify-center gap-1 px-2 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-60", b.tone)}
            >
              {status === b.status && <Check aria-hidden className="size-4" />}
              {status === b.status ? b.on : b.off}
            </button>
          ))}
        </div>
      )}

      {/* [Flecha]: cuadrado girado 45° que asoma por el borde | aria-hidden: decorativa | `-z-10`: bajo el contenido para no tapar los botones */}
      {pos && <span aria-hidden className={cn("absolute -z-10 rotate-45", arrowTone, pos.above ? "-bottom-1.5" : "-top-1.5 border-l border-t border-border")} style={{ left: arrowLeft - ARROW / 2, width: ARROW, height: ARROW }} />}
    </div>
  );
}

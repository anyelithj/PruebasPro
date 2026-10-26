// StoreSearch.tsx (Client Component · React + Tailwind) => buscador de la tienda en las páginas de Next.js (login,
// registro, recuperar contraseña). ESPEJO EXACTO de StoreSearch.vue (Nuxt): mismo marcado, clases, íconos SVG
// (manifiesto compartido admin-nav.json) y funciones, para que el buscador sea UNO solo en toda la aplicación:
// - Texto con AUTOCOMPLETADO: <datalist> nativo alimentado por GET /search/suggestions (debounce de 300 ms).
//   Sin JavaScript sigue siendo un <form method="get"> hacia /products?q= de la tienda (Progressive Enhancement).
// - VOZ: Web Speech API (SpeechRecognition); el botón solo aparece si el navegador la soporta.
// - QR / CÓDIGO DE BARRAS: BarcodeDetector nativo sobre una foto (input capture); enlace => se abre, otro texto => búsqueda.
// - IMAGEN: enlace a /search de la tienda (búsqueda visual con IA, RF-06.4).
// Patrones: Facade (apiGet), Observer (useEffect + useDebounce), Feature Detection, Adapter (storeUrl: ruta -> URL de Nuxt).
"use client"; // Directiva de Next.js: usa estado, efectos y APIs del navegador => se ejecuta en el cliente

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react"; // Hooks y tipos de eventos de React
import type { AdminLocale, AdminNav } from "@ecommerce/shared-types"; // "import type" => solo tipos (0 bytes)
import navData from "@ecommerce/shared-types/admin-nav.json"; // Íconos SVG compartidos con Nuxt
import { apiGet } from "@/shared/lib/api-client"; // Facade REST hacia Express
import { useDebounce } from "@/shared/hook/useDebounce"; // Hook propio: retrasa el valor hasta que se deja de escribir
import { toast } from "@/shared/ui/Toast"; // API imperativa de avisos (Observer)

const ICONS = (navData as AdminNav).icons; // "as" => aserción: el JSON cumple el contrato compartido

// Textos = los mismos de Nuxt i18n "store.search.*" (Record<AdminLocale, ...> => el compilador exige ambos idiomas)
const TEXT: Record<AdminLocale, Record<"label" | "placeholder" | "submit" | "voice" | "voiceError" | "qr" | "qrNotFound" | "image", string>> = {
  es: { label: "Buscar productos", placeholder: "Buscar productos, marcas o categorías", submit: "Buscar", voice: "Buscar por voz", voiceError: "No pudimos escucharte. Intenta de nuevo.", qr: "Escanear código QR o de barras", qrNotFound: "No encontramos un código en la foto.", image: "Buscar con una foto" },
  en: { label: "Search products", placeholder: "Search products, brands or categories", submit: "Search", voice: "Search by voice", voiceError: "We couldn't hear you. Please try again.", qr: "Scan a QR or barcode", qrNotFound: "We couldn't find a code in the photo.", image: "Search with a photo" },
};

// Clases compartidas con StoreSearch.vue (DRY entre microfrontends): campo de 40 px y botones de 32 px
const ICON_BUTTON = "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const FIELD = "h-10 w-full rounded-full border border-slate-300 bg-slate-50 pl-4 pr-36 text-sm placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-ring";

// Tipos mínimos de las APIs experimentales del navegador (no están en lib.dom.d.ts): tipado seguro sin "any"
type Recognition = { lang: string; interimResults: boolean; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void };
type Detector = new () => { detect: (image: ImageBitmap) => Promise<Array<{ rawValue: string }>> };
type Suggestion = { type: string; label: string };

// SearchIcon => SVG del manifiesto. dangerouslySetInnerHTML es seguro: marcado estático del repo, nunca del usuario
const SearchIcon = ({ name }: { name: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="size-[18px]" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[name] ?? "" }} />;

// toUrl => URL si el texto del código es un enlace válido; null si es un SKU/EAN u otro texto (función pura)
const toUrl = (text: string): URL | null => {
  try {
    return new URL(text);
  } catch {
    return null;
  }
};

interface Props {
  id: string; // "id" único: la cabecera monta dos buscadores (escritorio y móvil)
  locale: AdminLocale;
  store: string; // URL base de la tienda Nuxt en el idioma actual
  compact?: boolean; // Móvil: ocupa todo el ancho
}

export function StoreSearch({ id, locale, store, compact = false }: Props) {
  const text = TEXT[locale];
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [voiceSupported, setVoiceSupported] = useState(false); // Se detecta en useEffect: SSR no tiene "window"
  const [qrSupported, setQrSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const scanInput = useRef<HTMLInputElement>(null); // useRef => referencia al <input type="file"> oculto
  const debounced = useDebounce(query, 300);

  // search => navega a los resultados de la TIENDA (otra app): asignar location es una navegación completa
  const search = (value: string) => {
    if (value.trim()) window.location.assign(`${store}/products?q=${encodeURIComponent(value.trim())}`);
  };

  // Detección de capacidades (una vez, en el navegador)
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    setVoiceSupported(Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition)); // Chrome/Edge/Safari
    setQrSupported("BarcodeDetector" in window); // Chrome/Edge en Android y escritorio
  }, []);

  // Autocompletado: una petición al dejar de escribir (2+ letras); AbortController cancela la anterior (sin carreras)
  useEffect(() => {
    const value = debounced.trim();
    if (value.length < 2) return setSuggestions([]);
    const controller = new AbortController();
    apiGet<Suggestion[]>("/search/suggestions", { query: { q: value }, signal: controller.signal })
      .then(setSuggestions)
      .catch(() => undefined); // Los errores no interrumpen la búsqueda por texto
    return () => controller.abort(); // Cleanup del efecto: cancela si el texto cambia antes de responder
  }, [debounced]);

  // listen => dictado por voz (RF-06.2): el texto reconocido se busca de inmediato
  const listen = () => {
    const w = window as unknown as Record<string, new () => Recognition>;
    const RecognitionClass = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!RecognitionClass) return;
    const recognition = new RecognitionClass();
    recognition.lang = locale === "en" ? "en-US" : "es-CO";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const heard = event.results[0]?.[0]?.transcript ?? "";
      setQuery(heard);
      search(heard);
    };
    recognition.onerror = () => toast.error(text.voiceError);
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  };

  // onScan => QR/código de barras (RF-06.2): enlace de la tienda => se abre; otro texto (SKU, EAN) => búsqueda
  const onScan = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const BarcodeDetector = (window as unknown as { BarcodeDetector: Detector }).BarcodeDetector;
      const [code] = await new BarcodeDetector().detect(await createImageBitmap(file));
      if (!code) return toast.error(text.qrNotFound);
      const url = toUrl(code.rawValue);
      if (url && url.href.startsWith(store)) window.location.assign(url.href);
      else search(code.rawValue);
    } catch {
      toast.error(text.qrNotFound);
    } finally {
      event.target.value = ""; // Permite volver a escanear la misma foto
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault(); // Con JS: navegación controlada; sin JS el navegador envía el GET del <form>
    search(query);
  };

  return (
    <form role="search" method="get" action={`${store}/products`} onSubmit={onSubmit} className={compact ? "relative w-full" : "relative w-full max-w-md"}>
      <label htmlFor={id} className="sr-only">
        {text.label}
      </label>
      <input id={id} name="q" type="search" list={`${id}-list`} autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text.placeholder} className={FIELD} />
      {/* datalist => sugerencias nativas del navegador (productos, categorías y marcas) */}
      <datalist id={`${id}-list`}>
        {suggestions.map((item) => (
          <option key={`${item.type}-${item.label}`} value={item.label} />
        ))}
      </datalist>
      <div className="absolute inset-y-0 right-1 flex items-center">
        {voiceSupported && (
          <button type="button" onClick={listen} aria-label={text.voice} title={text.voice} aria-pressed={listening} className={`${ICON_BUTTON} ${listening ? "animate-pulse bg-red-100 text-red-700" : ""}`}>
            <SearchIcon name="mic" />
          </button>
        )}
        {qrSupported && (
          <>
            <button type="button" onClick={() => scanInput.current?.click()} aria-label={text.qr} title={text.qr} className={ICON_BUTTON}>
              <SearchIcon name="qr" />
            </button>
            {/* capture="environment" => en el celular abre la cámara trasera directamente */}
            <input ref={scanInput} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onScan} />
          </>
        )}
        <a href={`${store}/search`} aria-label={text.image} title={text.image} className={ICON_BUTTON}>
          <SearchIcon name="camera" />
        </a>
        <button type="submit" aria-label={text.submit} title={text.submit} className={ICON_BUTTON}>
          <SearchIcon name="search" />
        </button>
      </div>
    </form>
  );
}

"use client"; // [Next.js]: Client Component → pide el título traducido al BFF al montarse
import { useEffect, useState } from "react";
import { SpeakButton } from "@/components/curriculum/SpeakButton";
// [TopicTitle · 2026-10-19]: el tema de un vocabulario (guardado en español) en el IDIOMA ESTUDIADO con su IPA, su audio y la traducción al español
// → «🔤 The family /ðə ˈfæm.ɪ.li/ 🔊 · La familia» | [Patrón]: Presentational + Fetch-on-mount (BFF /api/vocabulary/lookup/topic → NestJS → FastAPI) | [Principio]: SRP + Progressive Enhancement (sin servicio, no se pinta nada) | [Paradigma]: Declarativo
// [A11y]: el título lleva `lang`, el IPA `lang="xx-fonipa"` (no se lee como texto) y el botón de audio un nombre con el título

export interface Title {
  text: string;
  ipa: string | null; // [2026-10-27]: null = sin IPA (servicio de idiomas caído)
  ipaUs: string | null;
  translationEs: string;
  translated?: boolean; // [2026-10-27]: false → `text` es el tema original (backend en modo degradado) · opcional: respuestas anteriores no lo traían
}

// ───── [Caché de módulo · 2026-10-27] ─────
// [Por qué]: React StrictMode (dev) monta → desmonta → monta cada efecto, y una página con varias fichas del mismo tema repetía el POST
// → `Map` a nivel de MÓDULO (vive mientras la pestaña) con la PROMESA en vuelo: la segunda llamada reutiliza la primera en vez de abrir otra petición
// [Patrón]: Single-Flight + Cache-Aside + Negative Cache (fallo o resultado degradado → se recuerda poco tiempo y luego se reintenta) | [Principio]: DRY + Fail Soft
const NEGATIVE_TTL_MS = 60_000; // Fallo/degradado: 1 min sin reintentar (no se martillea un servicio caído en cada render)
const MAX_ENTRIES = 200; // Tope del `Map` (sin fugas en sesiones largas del panel de administración)
type Entry = { promise: Promise<Title | null>; expires: number }; // `expires: Infinity` = resultado completo (traducción + IPA)
const titles = new Map<string, Entry>();

// [isComplete]: solo se guarda «para siempre» un título traducido y con IPA; lo demás puede mejorar cuando vuelva el servicio | Puro
const isComplete = (t: Title | null, language: string): boolean => !!t && !!t.ipa && (language === "es" || t.translated !== false);

// [fetchTopicTitle]: exportada para pruebas | nunca rechaza (null = no hay nada que pintar)
export function fetchTopicTitle(topic: string, language: string): Promise<Title | null> {
  const key = `${language}|${topic.toLowerCase()}`;
  const hit = titles.get(key);
  if (hit && hit.expires > Date.now()) return hit.promise;
  if (titles.size >= MAX_ENTRIES) titles.delete(titles.keys().next().value!); // `Map` conserva el orden de inserción → se expulsa la más antigua (FIFO)
  const entry: Entry = { promise: Promise.resolve(null), expires: Infinity };
  // Sin AbortController: la petición es COMPARTIDA entre montajes (abortarla al desmontar dejaría sin título al siguiente)
  entry.promise = fetch("/api/vocabulary/lookup/topic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, language }),
  })
    .then((r) => (r.ok ? (r.json() as Promise<{ data?: Title } & Partial<Title>>) : null))
    // [Fix 2026-10-27]: NestJS envuelve la respuesta (TransformInterceptor → { statusCode, data, meta }) y el proxy /api/[...path] la reenvía tal cual
    // → `?.data ?? body` acepta ambos formatos | [Principio]: Tolerant Reader
    .then((b) => {
      const t = b?.data ?? b;
      return typeof t?.text === "string" && t.text.trim() ? (t as Title) : null;
    })
    .catch(() => null) // Red caída → el tema se sigue viendo en español (lo pinta la página)
    .then((t) => {
      if (!isComplete(t, language)) entry.expires = Date.now() + NEGATIVE_TTL_MS; // Caché negativa corta
      return t;
    });
  titles.set(key, entry);
  return entry.promise;
}

// [Solo pruebas]: vacía la caché entre casos
export const __resetTopicTitles = (): void => titles.clear();

// [compact · 2026-11-13]: filas de tablas → solo el título en el idioma estudiado (sin IPA ni audio; el detalle del tema los muestra)
export function TopicTitle({ topic, language, className = "", compact = false }: { topic: string; language: string; className?: string; compact?: boolean }) {
  const [title, setTitle] = useState<Title | null>(null);

  useEffect(() => {
    const clean = topic.trim();
    if (clean.length < 2 || !language) return;
    let active = true; // [Guardia]: si cambia el tema/idioma o se desmonta, la respuesta vieja no pisa el estado
    void fetchTopicTitle(clean, language).then((t) => active && setTitle(t));
    return () => {
      active = false;
    };
  }, [topic, language]);

  if (!title) return null;
  // [Sin traducción · 2026-10-27]: el texto sigue en español → `lang` y voz en español (un lector de pantalla no lo lee con fonética inglesa)
  const untranslated = language !== "es" && (title.translated === false || title.translationEs === title.text);
  const lang = untranslated ? "es" : language;
  if (compact) return untranslated ? null : <span className={`block text-xs font-normal text-muted-foreground ${className}`} lang={lang}>{title.text}</span>;
  return (
    <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm ${className}`}>
      <span className="font-bold text-tone-brand" lang={lang}>
        {title.text}
      </span>
      {title.ipa && (
        <span className="eeg-mono text-xs text-muted-foreground" lang={`${language}-fonipa`}>
          {title.ipa.startsWith("/") ? title.ipa : `/${title.ipa}/`}
        </span>
      )}
      {/* [Fix 2026-10-28 · /api/audio 503]: sin traducción el texto es el tema en ESPAÑOL con palabras del idioma estudiado («El verbo être») → se pedía GET /api/audio?language=es
          (voz española leyendo francés: pronunciación incorrecta y, con el motor ocupado, 503 en consola). Solo se ofrece audio del texto ya en el idioma estudiado */}
      {!untranslated && <SpeakButton text={title.text} lang={lang} label={`Escuchar «${title.text}»`} />}
      {/* [2026-10-27]: sin traducción (servicio de idiomas caído → el backend devuelve el tema tal cual) no se repite «La familia · La familia» */}
      {language !== "es" && !untranslated && <span className="text-muted-foreground">· {title.translationEs}</span>}
    </p>
  );
}

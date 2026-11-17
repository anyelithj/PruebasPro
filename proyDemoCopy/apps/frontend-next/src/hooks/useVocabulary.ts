"use client"; // [Next.js]: hooks de cliente (fetch al BFF con la cookie de sesión)
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
// [useVocabulary · 2026-10-28]: diccionario al pulsar una palabra (IPA + traducción según la frase) y «Aprender / Aprendido» en React
// REUTILIZA los endpoints existentes (sin BFF nuevo): /api/vocabulary/lookup/word (NestJS → FastAPI /language-tools/word, caché LanguageLookup) y /api/vocabulary/words (RF-137)
// Mismo contrato que el repositorio Angular (core/dictionary) → misma caché y mismas palabras marcadas en las dos apps | [Patrón]: Repository + Cache-Aside (Map en memoria) + Custom Hook | [Principio]: DRY + SRP | [Paradigma]: Reactivo + Asíncrono

// [Idiomas admitidos]: = enum Language de NestJS (los DTO validan con @IsEnum) → otro código respondería 400
export const VOCAB_LANGUAGES = ["en", "es", "fr", "de", "pt", "zh", "ru"] as const;
export const isVocabLanguage = (l: string): boolean => (VOCAB_LANGUAGES as readonly string[]).includes(l);

export type WordStatus = "learning" | "learned";

// [WordInfo]: `result` de la fila LanguageLookup (kind = word) — snake_case del cable de FastAPI
export interface WordInfo {
  word: string;
  lemma: string | null;
  translation: string; // Vacía = la IA no respondió (el IPA sí llega)
  ipa: string | null;
  ipa_uk: string | null;
  ipa_us: string | null;
  examples: string[];
}

export interface MarkedWord {
  id: string;
  term: string;
  termKey?: string;
  status: WordStatus | null;
}

// [termKey]: misma normalización que NestJS (`termKeyOf`) → «Farm » y «farm» son la misma palabra | Función pura
export const termKey = (term: string): string => term.trim().toLowerCase().replace(/\s+/g, " ");

// [api]: fetch JSON al BFF + desenvuelve el sobre { statusCode, data } del TransformInterceptor de NestJS (acepta ambos formatos)
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  if (!res.ok) throw new Error(res.status === 401 ? "Inicia sesión para usar el diccionario" : `HTTP ${res.status}`);
  if (res.status === 204) return undefined as T;
  const body = (await res.json()) as { data?: T; statusCode?: number } & T;
  return (body && typeof body === "object" && "statusCode" in body && "data" in body ? body.data : body) as T;
}

// [Caché en memoria]: palabra+frase → promesa | `Map` (ES2015) a nivel de módulo → sobrevive al cerrar/abrir el popover (no repite la petición)
const lookupCache = new Map<string, Promise<WordInfo>>();

export function lookupWord(language: string, word: string, sentence?: string): Promise<WordInfo> {
  const key = `${language}|${termKey(word)}|${sentence ?? ""}`;
  let p = lookupCache.get(key);
  if (!p) {
    p = api<{ result: Partial<WordInfo> }>("/api/vocabulary/lookup/word", {
      method: "POST",
      body: JSON.stringify({ language, word: word.slice(0, 60), sentence: sentence?.slice(0, 400) || undefined }), // Límites = LookupWordDto
    }).then(({ result }) => ({
      word: result.word || word,
      lemma: result.lemma ?? null,
      translation: result.translation ?? "",
      ipa: result.ipa ?? null,
      ipa_uk: result.ipa_uk ?? null,
      ipa_us: result.ipa_us ?? null,
      examples: result.examples ?? [],
    }));
    p.then((info) => info.translation || lookupCache.delete(key), () => lookupCache.delete(key)); // [Fix 2026-10-31]: ni un error ni una traducción vacía (IA ocupada) quedan cacheados → se puede reintentar
    lookupCache.set(key, p);
  }
  return p;
}

// [useAccent · 2026-10-31]: acento UK/US compartido con Angular (misma cookie `aula-accent` y mismo evento `aula:accent-changed` en window) | `useSyncExternalStore` (React 18): estado externo sin desajuste de hidratación | [Patrón]: Observer
export type Accent = "uk" | "us";
const readAccent = (): Accent => (/(?:^|;\s*)aula-accent=uk(?:;|$)/.test(document.cookie) ? "uk" : "us");
const subscribeAccent = (cb: () => void) => {
  window.addEventListener("aula:accent-changed", cb);
  return () => window.removeEventListener("aula:accent-changed", cb);
};
export function useAccent() {
  const accent = useSyncExternalStore<Accent>(subscribeAccent, readAccent, () => "us");
  const setAccent = useCallback((a: Accent) => {
    document.cookie = `aula-accent=${a}; path=/; max-age=31536000; samesite=lax`;
    window.dispatchEvent(new CustomEvent("aula:accent-changed", { detail: a }));
  }, []);
  return { accent, setAccent };
}

// [useWordIpa · 2026-10-31]: IPA sin esperar a la traducción (espeak-ng, sin LLM) | fallo → null: la consulta completa también la trae | `Map`: una petición por palabra
export interface WordIpa {
  ipa: string | null;
  ipa_us: string | null;
}
const ipaCache = new Map<string, Promise<WordIpa | null>>();
export function useWordIpa(language: string, word: string) {
  const key = `${language}|${termKey(word)}`;
  const [state, setState] = useState<{ key: string; data: WordIpa | null }>({ key: "", data: null });
  useEffect(() => {
    if (!isVocabLanguage(language)) return;
    let alive = true;
    let p = ipaCache.get(key);
    if (!p) {
      p = api<WordIpa>("/api/vocabulary/lookup/word/ipa", { method: "POST", body: JSON.stringify({ language, word: word.slice(0, 60) }) }).catch(() => {
        ipaCache.delete(key);
        return null;
      });
      ipaCache.set(key, p);
    }
    void p.then((data) => alive && setState({ key, data }));
    return () => {
      alive = false;
    };
  }, [key, language, word]);
  return state.key === key ? state.data : null;
}

// [useWordLookup]: estado { data, error, loading } de una consulta | el estado se fija en la promesa (no síncrono en el efecto) | `retry` (2026-10-31): vuelve a preguntar a la IA
export function useWordLookup(language: string, word: string | null, sentence?: string) {
  const [attempt, setAttempt] = useState(0);
  const key = word ? `${language}|${word}|${sentence ?? ""}|${attempt}` : "";
  const [state, setState] = useState<{ key: string; data?: WordInfo; error?: string }>({ key: "" });
  useEffect(() => {
    if (!word || !isVocabLanguage(language)) return;
    let alive = true; // Ignora respuestas de una palabra anterior (carrera)
    lookupWord(language, word, sentence)
      .then((data) => alive && setState({ key, data }))
      .catch((e: Error) => alive && setState({ key, error: e.message }));
    return () => {
      alive = false;
    };
  }, [key, language, word, sentence]);
  const supported = isVocabLanguage(language);
  const fresh = state.key === key; // Resultado de ESTA palabra (estado derivado → sin parpadeo de la anterior)
  return {
    data: fresh ? state.data : undefined,
    error: !supported ? "Diccionario no disponible para este idioma" : fresh ? state.error : undefined,
    loading: supported && Boolean(word) && !fresh,
    retry: useCallback(() => setAttempt((n) => n + 1), []),
  };
}

// [useMarkedWords]: palabras «aprendiendo/aprendidas» del usuario en el idioma → resaltado en el texto + botones del popover
export function useMarkedWords(language: string) {
  const [words, setWords] = useState<ReadonlyMap<string, MarkedWord>>(new Map());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isVocabLanguage(language)) return;
    let alive = true;
    api<MarkedWord[]>(`/api/vocabulary/words?language=${encodeURIComponent(language)}`)
      .then((list) => alive && setWords(new Map(list.map((w) => [w.termKey ?? termKey(w.term), w]))))
      .catch(() => {}); // Sin sesión o sin backend → sin resaltado (degradación elegante)
    return () => {
      alive = false;
    };
  }, [language]);

  // [setStatus]: «Aprender» → POST /words (crea la entrada + flashcard) · «Aprendido» → POST si no existe + PATCH …/status | idempotente
  const setStatus = useCallback(
    async (word: string, status: WordStatus, extra?: { translation?: string; sentence?: string }) => {
      const k = termKey(word);
      setBusy(true);
      setError(null);
      try {
        let entry = words.get(k);
        if (!entry || entry.status === null) {
          entry = await api<MarkedWord>("/api/vocabulary/words", {
            method: "POST",
            body: JSON.stringify({ language, word: word.slice(0, 160), translation: extra?.translation?.slice(0, 300) || undefined, sentence: extra?.sentence?.slice(0, 600) || undefined }),
          });
        }
        if (entry.status !== status) {
          entry = await api<MarkedWord>(`/api/vocabulary/words/${encodeURIComponent(entry.id)}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
        }
        const saved = entry;
        setWords((prev) => new Map(prev).set(k, saved)); // Inmutable → React detecta el cambio
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [language, words],
  );

  return { words, setStatus, busy, error };
}

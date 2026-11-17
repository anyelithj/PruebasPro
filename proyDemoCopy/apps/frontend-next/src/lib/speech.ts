// [Speech]: pronunciación con la voz del navegador (Web Speech API, sin servidor ni red) | [Patrón]: Facade + Factory | [Principio]: DRY (lector de PDF y fichas de vocabulario) + SRP | [Paradigma]: Funcional
// [Software verde]: la síntesis ocurre en el dispositivo → cero cómputo en servidores y cero audio descargado

// [hasSpeech]: detección de la API (SSR-safe: en el servidor no hay `window`) | `typeof` (JS) evita ReferenceError
export const hasSpeech = (): boolean => typeof window !== "undefined" && "speechSynthesis" in window;

// [NATURAL · 2026-10-20]: voces neuronales que traen Edge/Chrome/Windows 11/macOS → suenan humanas (espeak-ng del servidor suena robótico)
const NATURAL = /natural|neural|online|google|premium|enhanced|siri/i;

// [pickVoice]: la mejor voz instalada del idioma ("fr" → "fr-FR"): natural +2, misma región +1 | `sort` (ES2015)
export const pickVoice = (lang: string): SpeechSynthesisVoice | undefined => {
  const tag = lang.toLowerCase();
  const base = tag.split("-")[0];
  const score = (v: SpeechSynthesisVoice) => (NATURAL.test(v.name) ? 2 : 0) + (v.lang.toLowerCase().replace("_", "-") === tag ? 1 : 0);
  return speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith(base))
    .sort((a, b) => score(b) - score(a))[0];
};

// [hasNaturalVoice]: ¿hay voz natural para el idioma? → se prefiere al audio del servidor
export const hasNaturalVoice = (lang: string): boolean => hasSpeech() && NATURAL.test(pickVoice(lang)?.name ?? "");

// [speakSymbols · 2026-11-16]: «=» se dice con palabras del idioma de la voz («es igual»: «igual a» sonaba «iguala») | TODA voz pasa por aquí
// (lector de PDF/temario, botones 🔊 y audio del servidor) → un solo punto | [Paradigma]: Funcional (pura)
const EQUALS: Readonly<Record<string, string>> = { es: "es igual", en: "equals", fr: "égale", de: "gleich", pt: "é igual", it: "è uguale", ru: "равно", zh: "等于" };
export const speakSymbols = (text: string, lang: string): string =>
  text.replace(/\s*=\s*/g, ` ${EQUALS[lang.toLowerCase().split("-")[0]!] ?? EQUALS.es} `).trim();

// [utterance]: cancela lo que suene y prepara la frase con la voz del idioma | [Patrón]: Factory
// `cancel = false` (2026-11-16): para ENCOLAR varios trozos seguidos (si no, cada uno cortaba al anterior y solo sonaba el último)
export function utterance(text: string, lang: string, rate = 1, cancel = true): SpeechSynthesisUtterance {
  if (cancel) speechSynthesis.cancel(); // Una sola voz a la vez
  const u = new SpeechSynthesisUtterance(speakSymbols(text, lang)); // `SpeechSynthesisUtterance` (Web Speech API) · «=» con palabras
  u.lang = lang;
  u.rate = rate;
  const voice = pickVoice(lang);
  if (voice) u.voice = voice;
  return u;
}

// [speak]: pronuncia un texto; devuelve false si el navegador no admite voz
export function speak(text: string, lang: string, rate = 1): boolean {
  if (!hasSpeech() || !text.trim()) return false;
  speechSynthesis.speak(utterance(text, lang, rate));
  return true;
}

// [playServerAudio · Sprint 4.7]: audio generado y cacheado por el servidor (misma voz en todos los navegadores, con su variante regional) | [Patrón]: Cache-Aside (el servidor genera solo la primera vez)
// `HTMLAudioElement.play()` (Web Audio): Promise que rechaza si el audio no carga → quien llama usa la voz del navegador como respaldo
export async function playServerAudio(text: string, lang: string, rate = 1, variant?: string): Promise<boolean> {
  if (typeof window === "undefined" || !text.trim()) return false;
  const params = new URLSearchParams({ text: speakSymbols(text, lang), language: lang, ...(variant ? { variant } : {}) }); // `URLSearchParams`: codifica tildes y espacios
  const audio = new Audio(`/api/audio?${params}`);
  audio.playbackRate = rate < 0.8 ? rate : 1; // [2026-10-20]: frenar un WAV lo trocea («cortante») → solo en el modo lento explícito
  try {
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

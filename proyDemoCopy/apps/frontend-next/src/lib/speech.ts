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

// [utterance]: cancela lo que suene y prepara la frase con la voz del idioma | [Patrón]: Factory
export function utterance(text: string, lang: string, rate = 1): SpeechSynthesisUtterance {
  speechSynthesis.cancel(); // Una sola voz a la vez
  const u = new SpeechSynthesisUtterance(text); // `SpeechSynthesisUtterance` (Web Speech API)
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
  const params = new URLSearchParams({ text: text.trim(), language: lang, ...(variant ? { variant } : {}) }); // `URLSearchParams`: codifica tildes y espacios
  const audio = new Audio(`/api/audio?${params}`);
  audio.playbackRate = rate < 0.8 ? rate : 1; // [2026-10-20]: frenar un WAV lo trocea («cortante») → solo en el modo lento explícito
  try {
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

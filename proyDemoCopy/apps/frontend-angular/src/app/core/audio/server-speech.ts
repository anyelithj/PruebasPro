import { ApiError } from '@core/http/error.interceptor';
// [server-speech · core/audio · 2026-10-25]: ¿puede el servidor transcribir? y qué decir al alumno si no (dictado del navegador o escribir) | [Patrón]: Graceful Degradation + Strategy (respaldo según lo que soporte el navegador) | [Principio]: DRY (diálogos, conversación y juegos orales comparten la regla) + SRP | [Paradigma]: Funcional (funciones puras)

// [Estados «no disponible»]: 0 = sin conexión · 502/504 = puerta de enlace · 503 = NestJS/FastAPI sin voz a texto | `ReadonlySet` (TS): inmutable
const DOWN_STATUSES: ReadonlySet<number> = new Set([0, 502, 503, 504]);

// [isServerSpeechDown]: el fallo es del servidor (no del audio) → se usa el respaldo en vez de mostrar un error
// `code` lo envía NestJS (SPEECH_ENGINE_MISSING, SPEECH_SERVICE_DOWN, SPEECH_INFERENCE_ERROR) | `?.` (ES2020): `code` es opcional
export function isServerSpeechDown(err: unknown): boolean {
  return (
    err instanceof ApiError && (DOWN_STATUSES.has(err.status) || !!err.code?.startsWith('SPEECH_'))
  );
}

// [liveDictationSupported]: Web Speech API (Chrome/Edge/Safari; Firefox no) | TypeScript no la declara → acceso por índice
export function liveDictationSupported(): boolean {
  if (typeof window === 'undefined') return false; // SSR / pruebas sin DOM
  const w = window as unknown as Record<string, unknown>;
  return typeof (w['SpeechRecognition'] ?? w['webkitSpeechRecognition']) === 'function';
}

// [Textos]: subconjunto de i18n `media.recorder` → la función no depende del diccionario completo | [Principio]: ISP
export interface SpeechFallbackLabels {
  serverOffLive: string; // Hay texto del dictado en vivo → revisar
  serverOffType: string; // No hay texto → escribir
  liveTip: string; // Navegador sin Web Speech → sugerir Chrome/Edge
}

// [speechFallbackNotice]: mensaje accionable según haya texto dictado y según el navegador
export function speechFallbackNotice(labels: SpeechFallbackLabels, hasLiveText: boolean): string {
  if (hasLiveText) return labels.serverOffLive;
  return liveDictationSupported()
    ? labels.serverOffType
    : `${labels.serverOffType} ${labels.liveTip}`;
}

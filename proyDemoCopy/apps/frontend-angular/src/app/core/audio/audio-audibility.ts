// [audio-audibility · core/audio · 2026-10-24]: ¿el audio descargado del servidor SUENA? (decodifica y mide RMS) | [Patrón]: Guard + Strategy (sin Web Audio → se confía en el servidor)
// [Por qué]: la respuesta de AULA llegaba como WAV «válido» pero mudo; el <audio> lo reproducía en silencio y nunca se pasaba a la voz del navegador
// [Principio]: SRP (solo mide; reproducir es de ServerAudioService) + Fail Fast | [Paradigma]: Funcional + async/await
// [Tecnología]: Web Audio API — `OfflineAudioContext.decodeAudioData` convierte WAV/MP3/Opus a muestras Float32 (-1..1) sin sonar ni pedir permiso

export const SILENCE_RMS = 0.001; // -60 dBFS: mismo umbral que FastAPI y NestJS (SSOT del criterio de silencio)
export const MIN_DURATION_S = 0.05; // < 50 ms = cabecera sin muestras
const WAV_HEADER_BYTES = 44; // Un WAV de 44 bytes o menos es solo cabecera
const MAX_SAMPLES = 50_000; // [Rendimiento]: se mide como mucho ~50 000 muestras por canal (paso uniforme) → < 1 ms

// [rms]: raíz de la media de los cuadrados (energía media) con paso `stride` | [Paradigma]: función pura
export function rms(samples: ArrayLike<number>, stride = 1): number {
  let energy = 0;
  let n = 0;
  for (let i = 0; i < samples.length; i += stride) {
    energy += samples[i]! * samples[i]!;
    n++;
  }
  return n ? Math.sqrt(energy / n) : 0;
}

// [isAudible]: true si alguna pista supera el umbral | false si está vacío, mudo o no se puede decodificar (el <audio> tampoco podría)
// [Degradación]: navegador sin Web Audio (o jsdom en pruebas) → true: no se puede comprobar y se intenta reproducir igual
export async function isAudible(blob: Blob): Promise<boolean> {
  if (blob.size <= WAV_HEADER_BYTES) return false;
  const Ctx = (globalThis as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext;
  if (!Ctx) return true;
  try {
    // `new OfflineAudioContext(1, 1, 44100)`: contexto mínimo que solo se usa para decodificar (no renderiza ni suena)
    const decoded = await new Ctx(1, 1, 44100).decodeAudioData(await blob.arrayBuffer());
    if (decoded.duration < MIN_DURATION_S) return false;
    const stride = Math.max(1, Math.floor(decoded.length / MAX_SAMPLES));
    return Array.from({ length: decoded.numberOfChannels }, (_, c) => decoded.getChannelData(c)).some(
      (ch) => rms(ch, stride) >= SILENCE_RMS,
    );
  } catch {
    return false; // `EncodingError`: bytes corruptos o formato no soportado
  }
}

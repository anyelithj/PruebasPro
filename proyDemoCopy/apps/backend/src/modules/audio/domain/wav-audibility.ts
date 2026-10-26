// [wav-audibility · Dominio Audio · 2026-10-24]: ¿el WAV que devolvió el motor de voz tiene muestras y SUENA? (RMS/pico sobre el PCM)
// [Por qué]: la respuesta de AULA llegaba como WAV válido pero mudo y se guardaba en la caché (MinIO) para siempre → ahora un audio vacío,
// corrupto o en silencio no se cachea ni se sirve: 503 y el navegador usa su propia voz | [Patrón]: Value Object + Guard | [Principio]: SRP + Fail Fast
// [Paradigma]: Funcional (funciones puras sobre Buffer, sin dependencias)

// [Umbral]: -60 dBFS (0,001 de la escala completa) — mismo valor que FastAPI (audio_quality.SILENCE_RMS) | [Principio]: SSOT del criterio
export const SILENCE_RMS = 0.001;
export const MIN_DURATION_S = 0.05; // Menos de 50 ms de muestras = cabecera sin datos

export interface WavStats {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  durationS: number;
  rms: number; // 0..1 (proporción de la escala completa)
  peak: number; // 0..1
}

// [Formatos]: 1 = PCM entero · 3 = IEEE float · 0xFFFE = WAVE_FORMAT_EXTENSIBLE (el subformato real va en el GUID; espeak/piper usan PCM)
const PCM = 1;
const FLOAT = 3;
const EXTENSIBLE = 0xfffe;

// [sampleReader]: lector de una muestra normalizada a -1..1 según formato y ancho | null = formato no soportado
function sampleReader(format: number, bits: number): ((b: Buffer, at: number) => number) | null {
  if (format === FLOAT && bits === 32) return (b, at) => b.readFloatLE(at);
  if (format !== PCM && format !== EXTENSIBLE) return null;
  if (bits === 8) return (b, at) => (b.readUInt8(at) - 128) / 128; // PCM de 8 bits es SIN signo
  if (bits === 16) return (b, at) => b.readInt16LE(at) / 32768;
  if (bits === 32) return (b, at) => b.readInt32LE(at) / 2147483648;
  return null;
}

// [inspectWav]: recorre los «chunks» RIFF (fmt, data…) y mide la energía | null si no es un WAV legible
// [Tolerante]: si la cabecera anuncia más bytes de los que hay (p. ej. `espeak-ng --stdout` deja 0x7FFFF000), se mide lo que realmente llegó
export function inspectWav(buf: Buffer): WavStats | null {
  if (buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return null;
  let fmt: { format: number; channels: number; sampleRate: number; bits: number } | null = null;
  for (let at = 12; at + 8 <= buf.length; ) {
    const id = buf.toString('ascii', at, at + 4);
    const size = buf.readUInt32LE(at + 4);
    const body = at + 8;
    if (id === 'fmt ' && body + 16 <= buf.length) {
      fmt = { format: buf.readUInt16LE(body), channels: buf.readUInt16LE(body + 2), sampleRate: buf.readUInt32LE(body + 4), bits: buf.readUInt16LE(body + 14) };
    } else if (id === 'data' && fmt) {
      const read = sampleReader(fmt.format, fmt.bits);
      if (!read || !fmt.channels || !fmt.sampleRate) return null;
      const width = fmt.bits / 8;
      const end = Math.min(buf.length, body + size); // `Math.min`: tamaño anunciado acotado a los bytes reales
      const count = Math.floor((end - body) / width);
      let energy = 0;
      let peak = 0;
      for (let i = 0; i < count; i++) {
        const s = read(buf, body + i * width);
        energy += s * s;
        peak = Math.max(peak, Math.abs(s));
      }
      return {
        sampleRate: fmt.sampleRate,
        channels: fmt.channels,
        bitsPerSample: fmt.bits,
        durationS: count / fmt.channels / fmt.sampleRate,
        rms: count ? Math.sqrt(energy / count) : 0,
        peak,
      };
    }
    at = body + size + (size % 2); // Los chunks RIFF se alinean a 2 bytes
  }
  return null;
}

// [silenceReason]: por qué el audio no sirve (para el log y el error) | null = suena bien
export function silenceReason(buf: Buffer): string | null {
  const stats = inspectWav(buf);
  if (!stats) return 'no es un WAV PCM legible';
  if (stats.durationS < MIN_DURATION_S) return 'audio vacío (sin muestras)';
  if (stats.rms < SILENCE_RMS) return `audio en silencio (RMS ${stats.rms.toFixed(5)})`;
  return null;
}

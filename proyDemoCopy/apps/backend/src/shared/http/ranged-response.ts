import type { Response } from 'express';
import type { Readable } from 'stream';
// [Respuesta por rangos · Sprint 6.6]: lógica HTTP 200/206/416 compartida por audio, materiales de curso y reportes | [Patrón]: Template Method (función) | [Principio]: DRY + SRP | [Paradigma]: Funcional
// [Tecnología]: Express Response + streams de Node (disco, MinIO o R2 entregan un Readable) · redirección 302 a URL firmada (Sprint 6.7)

// [Rango de bytes]: el reproductor del navegador pide trozos (Range: bytes=0-) para poder adelantar
export interface ByteRange {
  start: number;
  end: number; // Inclusivo
}

// [parseRange]: «bytes=100-» · «bytes=100-199» · «bytes=-500» → rango válido; null si no hay cabecera; 'invalid' si no se puede servir (→ 416)
export function parseRange(
  header: string | undefined,
  size: number,
): ByteRange | null | 'invalid' {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim()); // Solo un rango (varios rangos no se soportan → se responde completo)
  if (!m || (!m[1] && !m[2])) return 'invalid';
  const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2])); // «-500» = últimos 500 bytes
  const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  return start <= end && start < size ? { start, end } : 'invalid';
}

// `export interface` (TS): lo que necesita la respuesta → tamaño + cómo abrir el flujo (desde cualquier almacenamiento) | [Principio]: DIP
export interface RangedSource {
  size: number;
  contentType: string;
  open(range?: ByteRange): Promise<Readable>;
  signedUrl?: string | null; // [Sprint 6.7]: URL firmada del bucket (S3/R2) → 302 y el navegador pide los rangos directo al almacén
}

// [sendRanged]: escribe cabeceras y canaliza el flujo; el llamador fija antes las cabeceras propias (Content-Disposition, Cache-Control…)
export async function sendRanged(
  res: Response,
  rangeHeader: string | undefined,
  src: RangedSource,
): Promise<void> {
  // [Redirección firmada · Sprint 6.7]: el backend no transporta los bytes (R2 no cobra salida); `no-store`: la URL caduca y no debe cachearse
  if (src.signedUrl) {
    res.setHeader('Cache-Control', 'private, no-store');
    res.redirect(302, src.signedUrl);
    return;
  }
  const range = parseRange(rangeHeader, src.size);
  if (range === 'invalid') {
    res.status(416).setHeader('Content-Range', `bytes */${src.size}`).end(); // 416: rango fuera del archivo
    return;
  }
  res.setHeader('Accept-Ranges', 'bytes'); // El cliente sabe que puede pedir trozos
  res.setHeader('Content-Type', src.contentType);
  if (range) {
    res
      .status(206)
      .setHeader(
        'Content-Range',
        `bytes ${range.start}-${range.end}/${src.size}`,
      );
    res.setHeader('Content-Length', String(range.end - range.start + 1));
  } else {
    res.setHeader('Content-Length', String(src.size));
  }
  (await src.open(range ?? undefined)).pipe(res); // `pipe` (Node streams): almacenamiento → cliente con control de flujo
}

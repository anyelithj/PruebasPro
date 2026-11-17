import { randomUUID } from 'node:crypto'; // [Node.js crypto]: UUID v4 aleatorio (no consecutivo, no adivinable)
// [pronunciation-media · 2026-11-14]: imagen o video de la BOCA para «Cómo se pronuncia» (fichas de pronunciación)
// La clave guarda el tipo MIME en su nombre («video-mp4-<uuid>») → se sirve con su Content-Type sin una tabla extra y solo usa [\w-]
// (segmentos que acepta la lista blanca del BFF de Next.js) | [Patrón]: Value Object en funciones puras | [Principio]: SRP + Fail Fast | [Paradigma]: Funcional

export const MAX_PRONUNCIATION_MEDIA_BYTES = 30 * 1024 * 1024; // 30 MB: un clip corto de la boca en primer plano

// [Lista blanca]: formatos que todos los navegadores muestran sin complementos (imagen y video HTML5) | `as const` (TS): tupla literal
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'] as const;
export type PronunciationMediaMime = (typeof ALLOWED)[number]; // Unión de literales derivada de la lista (SSOT)

const KEY = /^(image|video)-(png|jpeg|webp|gif|mp4|webm)-[0-9a-f-]{36}$/; // Formato exacto de una clave válida

// [isAllowedMime]: ¿se acepta este archivo? | `includes` sobre la lista blanca | type guard (TS): estrecha el tipo
export function isAllowedMime(mime: string): mime is PronunciationMediaMime {
  return (ALLOWED as readonly string[]).includes(mime);
}

// [newMediaKey]: «image/jpeg» → «image-jpeg-<uuid>» (sin nombre de archivo ni datos personales)
export function newMediaKey(mime: PronunciationMediaMime): string {
  return `${mime.replace('/', '-')}-${randomUUID()}`;
}

// [mimeOfKey]: inverso de newMediaKey; null si la clave no tiene el formato (Fail Fast: no se abre nada del almacén)
export function mimeOfKey(key: string): PronunciationMediaMime | null {
  const m = KEY.exec(key);
  return m ? (`${m[1]}/${m[2]}` as PronunciationMediaMime) : null;
}

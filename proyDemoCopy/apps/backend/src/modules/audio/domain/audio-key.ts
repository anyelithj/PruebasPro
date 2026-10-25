import { createHash } from 'crypto';
import type { Language } from '../../../shared/domain/language.vo';
// [Clave de caché del audio · Sprint 4.7]: misma palabra + idioma + variante + motor → mismo audio (se genera UNA vez) | [Patrón]: Cache-Aside (clave determinista) | [Principio]: Deterministic-first | [Paradigma]: Funcional (funciones puras)

export interface AudioRequest {
  text: string;
  language: Language;
  variant: string; // BCP-47 ya resuelta (la pedida o la del idioma)
}

// [normalizeText]: «  Water » y «water» suenan igual → misma clave | `normalize('NFC')` (ES2015): misma forma Unicode para tildes compuestas
export const normalizeText = (text: string): string =>
  text.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();

// [audioKey]: sha256 en hex (64 caracteres) | `createHash` (Node crypto): sin dependencias
export const audioKey = (req: AudioRequest, engine: string): string =>
  createHash('sha256')
    .update(
      [normalizeText(req.text), req.language, req.variant, engine].join('|'),
    )
    .digest('hex');

// [objectKey]: ruta del objeto (prefijo «pronunciation-audio»), agrupada por idioma y variante (fácil de inspeccionar en la consola de MinIO o de R2)
export const objectKey = (req: AudioRequest, key: string): string =>
  `${req.language}/${req.variant}/${key}.wav`;

// [Rango de bytes · HTTP 206]: definido en shared (lo comparten Audio, Courses y Reports) → se reexporta para no romper a los importadores | [Principio]: DRY
export {
  parseRange,
  type ByteRange,
} from '../../../shared/http/ranged-response';

import type { Readable } from 'stream';
import type { ByteRange } from '../audio-key';
// [AudioStoragePort · Sprint 4.7]: almacén de objetos para los audios (disco, MinIO en desarrollo o Cloudflare R2 en producción · Sprint 6.7) | [Patrón]: Port (Hexagonal) | [Principio]: DIP + ISP

export const AUDIO_STORAGE = Symbol('AUDIO_STORAGE'); // `Symbol` (ES2015): token único de inyección

export interface AudioStoragePort {
  put(objectKey: string, data: Buffer, contentType: string): Promise<void>;
  size(objectKey: string): Promise<number | null>; // null si el objeto ya no existe (la caché se reconstruye sola)
  read(objectKey: string, range?: ByteRange): Promise<Readable>; // `Readable` (Node streams): no carga el audio entero en memoria
  remove(objectKey: string): Promise<void>;
}

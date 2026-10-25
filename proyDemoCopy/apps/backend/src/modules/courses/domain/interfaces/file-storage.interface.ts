import type { Readable } from 'stream';
import type { ByteRange } from '../../../../shared/http/ranged-response';
import type { SignedUrlOptions } from '../../../../shared/storage/object-store';
// [Puerto FileStorage]: dónde viven los binarios de los materiales | [Patrón]: Port (Hexagonal) | [Principio]: DIP + OCP (disco local o S3 —MinIO/R2— cambiando solo el Adapter · Sprints 6.6 y 6.7)
// [Flujo]: multer escribe la subida en `directory` → `commit` la deja en su almacén definitivo → `open` la sirve por rangos o `signedUrl` la entrega directo desde el bucket

export interface FileStorage {
  // [directory]: carpeta donde multer escribe las subidas (definitiva en disco local, temporal con S3)
  readonly directory: string;
  // [commit]: lleva la subida de `directory` al almacén definitivo (no-op en disco local)
  commit(storageKey: string, contentType: string): Promise<void>;
  // [open]: flujo del binario (completo o un rango → video que se puede adelantar) | lanza si la clave es inválida
  open(storageKey: string, range?: ByteRange): Promise<Readable>;
  // [remove]: borra el binario (idempotente: no falla si ya no existe)
  remove(storageKey: string): Promise<void>;
  // [signedUrl · Sprint 6.7]: URL temporal del bucket; null en disco local → el backend sirve el flujo (ampliación retrocompatible del puerto)
  signedUrl(
    storageKey: string,
    options: SignedUrlOptions,
  ): Promise<string | null>;
}

export const FILE_STORAGE = Symbol('FILE_STORAGE'); // `Symbol` (ES2015): token único de inyección

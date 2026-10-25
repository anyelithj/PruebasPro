import { mkdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { Readable } from 'stream';
import type { ByteRange } from '../../../../shared/http/ranged-response';
import type {
  ObjectStore,
  SignedUrlOptions,
} from '../../../../shared/storage/object-store';
import type { FileStorage } from '../../domain/interfaces/file-storage.interface';
// [Adapter S3FileStorage · Sprint 6.7]: materiales en un bucket S3 (MinIO en desarrollo, Cloudflare R2 en producción) → varias instancias del backend comparten los archivos | [Patrón]: Adapter (sobre el ObjectStore del prefijo «course-materials») | [Principio]: LSP (mismo contrato que LocalFileStorage) + DIP (recibe el almacén; las pruebas le pasan uno en memoria)
// [Configuración]: STORAGE_PROVIDER=s3 · S3_* (ver shared/config/storage.config.ts)

export class S3FileStorage implements FileStorage {
  // `readonly directory` (TS): solo temporal → multer escribe aquí, `commit` sube y borra
  constructor(
    private readonly store: ObjectStore,
    readonly directory: string,
  ) {
    mkdirSync(directory, { recursive: true });
  }

  // `basename` (path): la clave es el UUID asignado al subir → nunca sale de la carpeta temporal | [Seguridad]: anti path-traversal
  private temp(storageKey: string): string {
    return join(this.directory, basename(storageKey));
  }

  async commit(storageKey: string, contentType: string): Promise<void> {
    await this.store.put(
      storageKey,
      { path: this.temp(storageKey) },
      contentType,
    ); // Subida por partes desde disco (no carga 500 MB en RAM)
    await rm(this.temp(storageKey), { force: true });
  }

  open(storageKey: string, range?: ByteRange): Promise<Readable> {
    return this.store.open(storageKey, range);
  }

  // [remove]: objeto + posible temporal (si falló antes de `commit`)
  async remove(storageKey: string): Promise<void> {
    await Promise.all([
      this.store.remove(storageKey),
      rm(this.temp(storageKey), { force: true }),
    ]);
  }

  signedUrl(
    storageKey: string,
    options: SignedUrlOptions,
  ): Promise<string | null> {
    return this.store.signedUrl(storageKey, options);
  }
}

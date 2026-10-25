import { Logger } from '@nestjs/common';
import type { Readable } from 'stream';
import type { ByteRange } from '../http/ranged-response';
import type { ObjectStore, SignedUrlOptions } from './object-store';
// [MirroredObjectStore · 2026-10-19]: guarda cada objeto en la NUBE (S3: MinIO/R2) y una copia LOCAL en disco; lee de la nube y, si falla, del disco | [Patrón]: Decorator + Composite (dos almacenes con el mismo contrato) + Fallback | [Principio]: LSP + OCP (los módulos no cambian: siguen viendo un ObjectStore) | [Paradigma]: POO + async/await
// [Por qué]: los contenidos de cursos (PDF, video), audio y reportes no deben perderse si el bucket no responde (reloj desfasado, MinIO apagado) → la plataforma sirve la copia local
// ponytail: copia local de UN servidor; con varias instancias del backend apagar el espejo (STORAGE_LOCAL_MIRROR=false) o usar un volumen compartido

export class MirroredObjectStore implements ObjectStore {
  private readonly logger = new Logger(MirroredObjectStore.name);

  constructor(
    private readonly cloud: ObjectStore,
    private readonly local: ObjectStore,
  ) {}

  // [put]: primero la nube (lee el archivo temporal de multer), luego la copia local (que lo mueve a su sitio); la copia local nunca tumba la subida
  async put(key: string, data: Buffer | { path: string }, contentType: string): Promise<void> {
    await this.cloud.put(key, data, contentType);
    await this.local.put(key, data, contentType).catch((err: unknown) => this.warn('copia local', key, err));
  }

  async size(key: string): Promise<number | null> {
    const remote = await this.cloud.size(key).catch(() => null);
    return remote ?? this.local.size(key);
  }

  async open(key: string, range?: ByteRange): Promise<Readable> {
    try {
      return await this.cloud.open(key, range);
    } catch (err) {
      this.warn('lectura en la nube (se usa la copia local)', key, err);
      return this.local.open(key, range);
    }
  }

  async remove(key: string): Promise<void> {
    await Promise.all([this.cloud.remove(key), this.local.remove(key).catch(() => undefined)]);
  }

  // [signedUrl]: URL de la nube; si el objeto no está allí (o la nube no responde) → null y el backend sirve el flujo desde el disco
  async signedUrl(key: string, options: SignedUrlOptions): Promise<string | null> {
    try {
      return await this.cloud.signedUrl(key, options);
    } catch (err) {
      this.warn('URL firmada (se sirve la copia local)', key, err);
      return null;
    }
  }

  private warn(what: string, key: string, err: unknown): void {
    this.logger.warn(`${what} «${key}»: ${err instanceof Error ? err.message : String(err)}`);
  }
}

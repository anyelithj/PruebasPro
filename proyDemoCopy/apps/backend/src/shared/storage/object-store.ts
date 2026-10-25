import { resolve } from 'node:path';
import type { Readable } from 'stream';
import { storageConfig } from '../config/storage.config';
import type { ByteRange } from '../http/ranged-response';
import { LocalObjectStore } from './local-object.store';
import { MirroredObjectStore } from './mirrored-object.store';
import { S3ObjectStore } from './s3-object.store';
// [ObjectStore · Sprint 6.7]: contrato común de almacenamiento de objetos para Audio, Courses (materiales) y Reports | [Patrón]: Port + Factory | [Principio]: DIP (los módulos dependen de esta interfaz, no de S3 ni del disco) + LSP (local y S3 son intercambiables)
// [Selección]: STORAGE_PROVIDER=local → disco · s3 → MinIO o Cloudflare R2 (sin tocar código)

// [Opciones de la URL firmada]: cómo debe entregar el navegador el archivo (cabeceras que R2/MinIO devuelven en la descarga)
export interface SignedUrlOptions {
  filename: string;
  contentType: string;
  disposition: 'inline' | 'attachment'; // inline = reproducir/ver · attachment = descargar
}

export interface ObjectStore {
  // [put]: Buffer en memoria (audio, reportes) o ruta de un archivo temporal (subidas de multer, sin cargarlas en RAM)
  put(
    key: string,
    data: Buffer | { path: string },
    contentType: string,
  ): Promise<void>;
  // [size]: bytes del objeto o null si no existe (la caché de audio se reconstruye sola)
  size(key: string): Promise<number | null>;
  // [open]: flujo completo o solo el rango pedido (Range 206 sin leer el archivo entero)
  open(key: string, range?: ByteRange): Promise<Readable>;
  // [remove]: idempotente (borrar algo inexistente no falla)
  remove(key: string): Promise<void>;
  // [signedUrl]: URL temporal para que el navegador descargue DIRECTO del bucket; null = este almacén no firma (disco) → el backend sirve el flujo
  signedUrl(key: string, options: SignedUrlOptions): Promise<string | null>;
}

// [createObjectStore]: fábrica única por prefijo de módulo («course-materials», «pronunciation-audio», «reports») | [Patrón]: Factory Method | [Principio]: OCP (otro proveedor = otra rama aquí)
export function createObjectStore(prefix: string): ObjectStore {
  const cfg = storageConfig();
  const local = new LocalObjectStore(resolve(cfg.uploadsDir, prefix));
  if (!cfg.s3) return local;
  const cloud = new S3ObjectStore(cfg.s3, prefix, cfg.signedUrlTtl);
  // [2026-10-19]: nube + copia local (STORAGE_LOCAL_MIRROR=true por defecto) → si el bucket falla se sirve el disco
  return cfg.localMirror ? new MirroredObjectStore(cloud, local) : cloud;
}

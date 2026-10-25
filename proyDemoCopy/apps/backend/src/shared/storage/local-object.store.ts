import { createReadStream, mkdirSync } from 'node:fs'; // [Node.js fs]: lectura en flujo + carpeta creada al arrancar (síncrono: solo una vez)
import { copyFile, mkdir, rename, rm, stat, writeFile } from 'node:fs/promises'; // [Node.js fs/promises]: E/S asíncrona
import { dirname, resolve, sep } from 'node:path'; // [Node.js path]: rutas absolutas seguras entre Windows/Linux
import type { Readable } from 'stream';
import type { ByteRange } from '../http/ranged-response';
import { assertKey } from './object-key';
import type { ObjectStore } from './object-store';
// [LocalObjectStore · Sprint 6.7]: objetos en disco (STORAGE_PROVIDER=local) bajo UPLOADS_DIR/<prefijo> | [Patrón]: Adapter | [Principio]: LSP (mismo contrato que S3ObjectStore)
// ponytail: disco de UN servidor → con varias instancias del backend usar STORAGE_PROVIDER=s3 (el contrato no cambia)

export class LocalObjectStore implements ObjectStore {
  constructor(readonly root: string) {
    mkdirSync(root, { recursive: true }); // `recursive`: no falla si ya existe
  }

  // [Anti path-traversal]: la ruta resultante DEBE quedar dentro de la carpeta (rechaza "../../etc/passwd") | [Seguridad]
  path(key: string): string {
    assertKey(key);
    const full = resolve(this.root, key);
    if (!full.startsWith(this.root + sep))
      throw new Error('Clave de almacenamiento inválida');
    return full;
  }

  // El tipo MIME no se guarda en disco: lo aporta el registro de la BD al servir
  async put(key: string, data: Buffer | { path: string }): Promise<void> {
    const target = this.path(key);
    await mkdir(dirname(target), { recursive: true }); // Claves con «/» (audio por idioma) → subcarpetas
    if (Buffer.isBuffer(data)) return writeFile(target, data);
    if (resolve(data.path) === target) return; // multer ya escribió en su sitio definitivo
    // `rename` es atómico en el mismo disco; EXDEV = otra unidad → copiar y borrar
    await rename(data.path, target).catch(
      async (err: NodeJS.ErrnoException) => {
        if (err.code !== 'EXDEV') throw err;
        await copyFile(data.path, target);
        await rm(data.path, { force: true });
      },
    );
  }

  async size(key: string): Promise<number | null> {
    try {
      return (await stat(this.path(key))).size;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null; // No existe
      throw err;
    }
  }

  // `createReadStream({ start, end })` (Node fs): `end` inclusivo, igual que HTTP Range
  // `Promise.resolve`/`reject`: contrato asíncrono sin `async` vacío (la clave inválida llega como rechazo)
  open(key: string, range?: ByteRange): Promise<Readable> {
    try {
      return Promise.resolve(createReadStream(this.path(key), range));
    } catch (err) {
      return Promise.reject(
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  }

  async remove(key: string): Promise<void> {
    await rm(this.path(key), { force: true }); // `force`: idempotente
  }

  // [signedUrl]: el disco no firma URLs → el backend sirve el archivo con Range 206
  signedUrl(): Promise<null> {
    return Promise.resolve(null);
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolve } from 'node:path'; // [Node.js path]: ruta absoluta desde el cwd del proceso
import type { Readable } from 'stream';
import type { ByteRange } from '../../../../shared/http/ranged-response';
import { LocalObjectStore } from '../../../../shared/storage/local-object.store';
import type { FileStorage } from '../../domain/interfaces/file-storage.interface';
// [Adapter LocalFileStorage]: guarda los materiales en disco (carpeta UPLOADS_DIR/course-materials) | [Patrón]: Adapter (sobre LocalObjectStore) | [Principio]: SRP + LSP (mismo contrato que S3FileStorage) + DRY (anti path-traversal compartido)
// ponytail: disco local de UN servidor → con varias instancias usar STORAGE_PROVIDER=s3 (el puerto no cambia)

@Injectable()
export class LocalFileStorage implements FileStorage {
  readonly directory: string;
  private readonly store: LocalObjectStore;

  constructor(config: ConfigService) {
    // `config.get(clave, valor por defecto)` (NestJS): UPLOADS_DIR o «uploads»
    this.store = new LocalObjectStore(
      resolve(config.get<string>('UPLOADS_DIR', 'uploads'), 'course-materials'),
    );
    this.directory = this.store.root; // multer escribe directamente en la carpeta definitiva (sin copia)
  }

  // [commit]: multer ya escribió el archivo en su sitio definitivo
  async commit(): Promise<void> {}

  open(storageKey: string, range?: ByteRange): Promise<Readable> {
    return this.store.open(storageKey, range);
  }

  remove(storageKey: string): Promise<void> {
    return this.store.remove(storageKey);
  }

  // [signedUrl]: el disco no firma → el controlador sirve el archivo con Range 206
  signedUrl(): Promise<null> {
    return Promise.resolve(null);
  }
}

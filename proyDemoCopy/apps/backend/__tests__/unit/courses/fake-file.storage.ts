import { Readable } from 'stream';
import type { FileStorage } from '../../../src/modules/courses/domain/interfaces/file-storage.interface';
import type { ByteRange } from '../../../src/shared/http/ranged-response';
import type { SignedUrlOptions } from '../../../src/shared/storage/object-store';
// [FakeFileStorage · Sprint 6.7]: FileStorage en memoria, sin red ni disco → los casos de uso se prueban igual con disco, MinIO o R2 | [Patrón]: Test Double (Fake) | [Principio]: LSP (cumple el mismo puerto)

export class FakeFileStorage implements FileStorage {
  readonly directory = '/tmp/fake';
  readonly objects = new Map<string, { data: Buffer; contentType: string }>(); // `Map` (ES2015): clave → binario
  pending = new Map<string, Buffer>(); // Lo que «escribió multer» antes de commit

  // `signs` = true simula S3/R2 (URL firmada); false simula el disco local (null → streaming)
  constructor(private readonly signs = false) {}

  commit(storageKey: string, contentType: string): Promise<void> {
    this.objects.set(storageKey, { data: this.pending.get(storageKey) ?? Buffer.alloc(0), contentType });
    this.pending.delete(storageKey);
    return Promise.resolve();
  }

  open(storageKey: string, range?: ByteRange): Promise<Readable> {
    const obj = this.objects.get(storageKey);
    if (!obj) return Promise.reject(new Error('NoSuchKey'));
    return Promise.resolve(Readable.from(range ? obj.data.subarray(range.start, range.end + 1) : obj.data));
  }

  remove(storageKey: string): Promise<void> {
    this.objects.delete(storageKey);
    this.pending.delete(storageKey);
    return Promise.resolve();
  }

  signedUrl(storageKey: string, { disposition }: SignedUrlOptions): Promise<string | null> {
    return Promise.resolve(this.signs ? `https://bucket.example/${storageKey}?disposition=${disposition}&X-Amz-Signature=fake` : null);
  }
}

import type { Readable } from 'stream';
import type { ObjectStore } from '../../../../shared/storage/object-store';
import type { ByteRange } from '../../domain/audio-key';
import type { AudioStoragePort } from '../../domain/interfaces/audio-storage.interface';
// [Adapter ObjectAudioStorage · Sprints 4.7 y 6.7]: guarda y sirve los audios en el almacén de objetos (disco, MinIO o Cloudflare R2 según STORAGE_PROVIDER), con lectura por rangos (HTTP 206) | [Patrón]: Adapter (sobre el ObjectStore del prefijo «pronunciation-audio») | [Principio]: DIP + DRY + ISP (el puerto del audio no expone la API de S3)

export class ObjectAudioStorage implements AudioStoragePort {
  // `private readonly` (TS): composición en vez de herencia
  constructor(private readonly store: ObjectStore) {}

  put(objectKey: string, data: Buffer, contentType: string): Promise<void> {
    return this.store.put(objectKey, data, contentType);
  }

  size(objectKey: string): Promise<number | null> {
    return this.store.size(objectKey);
  }

  read(objectKey: string, range?: ByteRange): Promise<Readable> {
    return this.store.open(objectKey, range);
  }

  remove(objectKey: string): Promise<void> {
    return this.store.remove(objectKey);
  }
}

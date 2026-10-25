import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3'; // [AWS SDK v3 · modular]: solo se empaquetan los comandos usados
import { Upload } from '@aws-sdk/lib-storage'; // [Subida por partes]: archivos grandes en trozos en paralelo, sin cargarlos en RAM
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'; // [URL firmada SigV4]: se calcula en local, sin llamar a la red
import { createReadStream } from 'node:fs';
import type { Readable } from 'stream';
import type { S3Settings } from '../config/storage.config';
import type { ByteRange } from '../http/ranged-response';
import { assertKey } from './object-key';
import type { ObjectStore, SignedUrlOptions } from './object-store';
// [S3ObjectStore · Sprint 6.7]: ÚNICO adaptador S3 → MinIO en desarrollo y Cloudflare R2 en producción (solo cambian las variables S3_*) | [Patrón]: Adapter (Hexagonal) | [Principio]: DIP + LSP + OCP
// [Diseño]: un bucket (S3_BUCKET) con un prefijo por módulo → «course-materials/<uuid>», «pronunciation-audio/…», «reports/<uuid>.pdf»
// [Seguridad]: sin ACL (R2 no las implementa y los objetos quedan privados); el navegador solo entra con URL firmada de corta duración

// [Clientes por proceso]: keep-alive HTTP compartido entre módulos | [Patrón]: Flyweight (memo por endpoint)
const clients = new Map<string, S3Client>();
function client(s3: S3Settings, endpoint: string): S3Client {
  const id = `${endpoint}|${s3.S3_BUCKET}`;
  let c = clients.get(id);
  if (!c) {
    c = new S3Client({
      endpoint,
      region: s3.S3_REGION, // R2: "auto" (también acepta "us-east-1") · MinIO: "us-east-1"
      forcePathStyle: s3.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: s3.S3_ACCESS_KEY_ID,
        secretAccessKey: s3.S3_SECRET_ACCESS_KEY,
      },
      // [Compatibilidad R2/MinIO]: el SDK ≥ 3.729 añade sumas CRC a cada petición; solo se calculan cuando la operación las exige
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      maxAttempts: 3, // Reintentos con backoff exponencial ante 5xx/429 (R2: 1 escritura/s por clave)
    });
    clients.set(id, c);
  }
  return c;
}

// [notFound]: HeadObject sin cuerpo → el SDK devuelve «NotFound»; GetObject → «NoSuchKey»
function notFound(err: unknown): boolean {
  return (
    err instanceof S3ServiceException &&
    (err.$metadata.httpStatusCode === 404 ||
      err.name === 'NoSuchKey' ||
      err.name === 'NotFound')
  );
}

export class S3ObjectStore implements ObjectStore {
  private readonly s3: S3Client;
  private readonly signer: S3Client; // Mismo bucket, pero con el host que ve el navegador (S3_PUBLIC_ENDPOINT)
  private readonly bucket: string;

  constructor(
    settings: S3Settings,
    private readonly prefix: string,
    private readonly ttl: number,
  ) {
    assertKey(prefix);
    this.bucket = settings.S3_BUCKET;
    this.s3 = client(settings, settings.S3_ENDPOINT);
    this.signer = client(
      settings,
      settings.S3_PUBLIC_ENDPOINT ?? settings.S3_ENDPOINT,
    );
  }

  // [key]: prefijo del módulo + clave validada (UUID / hash) → no adivinable ni manipulable
  private key(key: string): string {
    assertKey(key);
    return `${this.prefix}/${key}`;
  }

  // `Upload.done()` (lib-storage): un PUT si cabe en una parte; si no, multipart de 8 MiB × 4 en paralelo (R2 admite 10 000 partes)
  async put(
    key: string,
    data: Buffer | { path: string },
    contentType: string,
  ): Promise<void> {
    await new Upload({
      client: this.s3,
      params: {
        Bucket: this.bucket,
        Key: this.key(key),
        Body: Buffer.isBuffer(data) ? data : createReadStream(data.path),
        ContentType: contentType,
      },
      partSize: 8 * 1024 * 1024,
      queueSize: 4,
    }).done();
  }

  async size(key: string): Promise<number | null> {
    try {
      const head = await this.s3.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.key(key) }),
      );
      return head.ContentLength ?? 0;
    } catch (err) {
      if (notFound(err)) return null; // La caché de audio se reconstruye sola
      throw err; // Credenciales, red o bucket inexistente → error visible (no se confunde con «no existe»)
    }
  }

  // [open]: `Range: bytes=a-b` lo resuelve el almacén (R2 y MinIO lo soportan en GetObject) → solo viajan los bytes pedidos
  async open(key: string, range?: ByteRange): Promise<Readable> {
    const res = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.key(key),
        Range: range ? `bytes=${range.start}-${range.end}` : undefined,
      }),
    );
    return res.Body as Readable; // En Node el cuerpo es un IncomingMessage (Readable) → se canaliza sin buffer
  }

  async remove(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: this.key(key) }),
    ); // Idempotente en S3
  }

  // [signedUrl]: GET firmado con las cabeceras de respuesta (tipo + nombre) → el navegador descarga del bucket y el backend no transporta los bytes
  // `encodeURIComponent` + RFC 5987 (filename*): nombres con tildes o espacios
  // [Reloj del almacén]: si el reloj del bucket va adelantado (VM de Docker/WSL tras suspender el equipo), una URL firmada con la hora local llega «caducada» (AccessDenied · Request has expired)
  // → HeadObject antes de firmar: el SDK mide el desfase con la cabecera Date de la respuesta (`config.systemClockOffset`) y se firma con la hora DEL ALMACÉN | [Principio]: Fail Fast (404 si el objeto no existe)
  async signedUrl(
    key: string,
    { filename, contentType, disposition }: SignedUrlOptions,
  ): Promise<string> {
    await this.s3.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: this.key(key) }),
    );
    const offset = this.s3.config.systemClockOffset ?? 0; // ms (positivo = el almacén va adelantado)
    return getSignedUrl(
      this.signer,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.key(key),
        ResponseContentType: contentType,
        ResponseContentDisposition: `${disposition}; filename*=UTF-8''${encodeURIComponent(filename)}`,
      }),
      { expiresIn: this.ttl, signingDate: new Date(Date.now() + offset) }, // `signingDate`: X-Amz-Date con la hora del almacén
    );
  }
}

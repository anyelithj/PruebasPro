import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'stream';
import { s3Settings } from '../../../src/shared/config/storage.config';
import { S3ObjectStore } from '../../../src/shared/storage/s3-object.store';
import { S3FileStorage } from '../../../src/modules/courses/infrastructure/storage/s3-file.storage';
// [Integración S3FileStorage · Sprint 6.7]: contra el MinIO de docker-compose (misma API S3 que Cloudflare R2) → subir, leer con Range, URL firmada y borrar | [Patrón]: Integration Test
// [Requisito]: `docker compose -f docker-compose.dev.yml up -d minio` · si MinIO no responde, la suite se omite (CI sin Docker)
// [Variables]: S3_TEST_ENDPOINT (por defecto http://localhost:9900) · credenciales por defecto de MinIO en desarrollo

const ENDPOINT = process.env.S3_TEST_ENDPOINT ?? 'http://localhost:9900';
const settings = s3Settings({
  S3_ENDPOINT: ENDPOINT,
  S3_REGION: 'us-east-1',
  S3_BUCKET: 'aula-test',
  S3_ACCESS_KEY_ID: process.env.MINIO_ROOT_USER ?? 'minioadmin',
  S3_SECRET_ACCESS_KEY: process.env.MINIO_ROOT_PASSWORD ?? 'minioadmin',
  S3_FORCE_PATH_STYLE: 'true',
});

// `fetch` (Node 18+): ¿MinIO arriba? | AbortSignal.timeout: no bloquea la suite
const minioUp = fetch(`${ENDPOINT}/minio/health/live`, { signal: AbortSignal.timeout(1500) })
  .then((r) => r.ok)
  .catch(() => false);

const text = async (r: Readable): Promise<string> => {
  const parts: Buffer[] = [];
  for await (const c of r) parts.push(Buffer.from(c as Buffer));
  return Buffer.concat(parts).toString();
};

describe('S3FileStorage contra MinIO', () => {
  let up = false;
  const dir = mkdtempSync(join(tmpdir(), 's3-int-'));
  const storage = new S3FileStorage(new S3ObjectStore(settings, 'course-materials', 120), dir);
  const key = `it-${Date.now()}`;

  beforeAll(async () => {
    up = await minioUp;
    if (!up) return;
    const admin = new S3Client({
      endpoint: ENDPOINT,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId: settings.S3_ACCESS_KEY_ID, secretAccessKey: settings.S3_SECRET_ACCESS_KEY },
    });
    await admin.send(new CreateBucketCommand({ Bucket: settings.S3_BUCKET })).catch(() => undefined); // Ya existe → sigue
  });

  it('subir, leer con Range, URL firmada (206) y borrar', async () => {
    if (!up) return console.warn('MinIO no disponible: se omite la integración S3');
    writeFileSync(join(dir, key), '0123456789');
    await storage.commit(key, 'video/mp4');

    await expect(text(await storage.open(key, { start: 2, end: 5 }))).resolves.toBe('2345');

    const url = await storage.signedUrl(key, { filename: 'clase.mp4', contentType: 'video/mp4', disposition: 'inline' });
    const res = await fetch(url!, { headers: { Range: 'bytes=7-' } }); // El navegador pide el rango directo al bucket
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 7-9/10');
    expect(res.headers.get('content-type')).toBe('video/mp4');
    await expect(res.text()).resolves.toBe('789');

    const tampered = url!.replace(/X-Amz-Expires=\d+/, 'X-Amz-Expires=604800'); // Firma alterada → 403
    expect((await fetch(tampered)).status).toBe(403);

    await storage.remove(key);
    await storage.remove(key); // Idempotente
    expect((await fetch(url!)).status).toBe(404);
  });
});

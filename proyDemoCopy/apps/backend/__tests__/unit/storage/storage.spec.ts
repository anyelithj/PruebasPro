import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client, S3ServiceException } from '@aws-sdk/client-s3';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'stream';
import { loadStorageConfig, s3Settings, validateStorageEnv } from '../../../src/shared/config/storage.config';
import { sendRanged } from '../../../src/shared/http/ranged-response';
import { LocalObjectStore } from '../../../src/shared/storage/local-object.store';
import { S3ObjectStore } from '../../../src/shared/storage/s3-object.store';
import { S3FileStorage } from '../../../src/modules/courses/infrastructure/storage/s3-file.storage';
// [Suite almacenamiento · Sprint 6.7]: configuración Zod, S3ObjectStore (MinIO/R2) sin red, LocalObjectStore y redirección firmada | [Patrón]: Test Double (spy de S3Client.send) | [Principio]: pruebas rápidas y deterministas

const ENV = {
  STORAGE_PROVIDER: 's3',
  S3_ENDPOINT: 'https://acc123.r2.cloudflarestorage.com',
  S3_BUCKET: 'aula-prod',
  S3_ACCESS_KEY_ID: 'AKIDEXAMPLE',
  S3_SECRET_ACCESS_KEY: 'super-secreto-no-debe-salir',
};

const text = async (r: Readable): Promise<string> => {
  const parts: Buffer[] = [];
  for await (const c of r) parts.push(Buffer.from(c as Buffer));
  return Buffer.concat(parts).toString();
};

describe('storage.config (Zod, Fail Fast)', () => {
  it('local por defecto, sin exigir S3_*', () => {
    expect(loadStorageConfig({})).toMatchObject({ provider: 'local', uploadsDir: 'uploads', maxUploadBytes: 500 * 1024 * 1024, signedUrlTtl: 900 });
  });

  it('s3 con R2: región "auto" y estilo virtual por defecto', () => {
    const cfg = loadStorageConfig({ ...ENV, MAX_UPLOAD_MB: '50' });
    expect(cfg.maxUploadBytes).toBe(50 * 1024 * 1024);
    expect(cfg.s3).toMatchObject({ S3_REGION: 'auto', S3_FORCE_PATH_STYLE: false });
  });

  it('una variable vacía cuenta como no definida (S3_PUBLIC_ENDPOINT= en .env)', () => {
    expect(loadStorageConfig({ ...ENV, S3_PUBLIC_ENDPOINT: '' }).s3?.S3_PUBLIC_ENDPOINT).toBeUndefined();
  });

  it('falla al arrancar si falta una variable y NO muestra el secreto', () => {
    const env = { ...ENV, S3_BUCKET: 'Bucket_Malo', S3_FORCE_PATH_STYLE: 'si' };
    expect(() => validateStorageEnv(env)).toThrow(/S3_BUCKET.*S3_FORCE_PATH_STYLE|S3_FORCE_PATH_STYLE.*S3_BUCKET/);
    try {
      validateStorageEnv(env);
    } catch (err) {
      expect(String(err)).not.toContain(ENV.S3_SECRET_ACCESS_KEY);
    }
    expect(() => loadStorageConfig({ STORAGE_PROVIDER: 'ftp' })).toThrow(/STORAGE_PROVIDER/);
  });
});

describe('S3ObjectStore (sin red)', () => {
  const send = jest.spyOn(S3Client.prototype, 'send');
  const store = new S3ObjectStore(s3Settings(ENV), 'course-materials', 300);
  afterEach(() => send.mockReset());

  it('put: prefijo del módulo + tipo, sin ACL', async () => {
    send.mockResolvedValue({} as never);
    await store.put('abc', Buffer.from('hola'), 'application/pdf');
    const cmd = send.mock.calls[0][0] as PutObjectCommand;
    expect(cmd).toBeInstanceOf(PutObjectCommand);
    expect(cmd.input).toMatchObject({ Bucket: 'aula-prod', Key: 'course-materials/abc', ContentType: 'application/pdf' });
    expect(cmd.input).not.toHaveProperty('ACL');
  });

  it('put desde archivo temporal (subida de multer)', async () => {
    send.mockResolvedValue({} as never);
    const file = join(mkdtempSync(join(tmpdir(), 's3-')), 'up');
    writeFileSync(file, 'video');
    await store.put('vid', { path: file }, 'video/mp4');
    expect((send.mock.calls[0][0] as PutObjectCommand).input.Key).toBe('course-materials/vid');
  });

  it('open: pide solo el rango al almacén (Range 206)', async () => {
    send.mockResolvedValue({ Body: Readable.from(['234']) } as never);
    await expect(text(await store.open('abc', { start: 2, end: 4 }))).resolves.toBe('234');
    const cmd = send.mock.calls[0][0] as GetObjectCommand;
    expect(cmd).toBeInstanceOf(GetObjectCommand);
    expect(cmd.input.Range).toBe('bytes=2-4');
  });

  it('size: bytes del objeto · null si no existe · otros errores se propagan', async () => {
    send.mockResolvedValueOnce({ ContentLength: 42 } as never);
    await expect(store.size('abc')).resolves.toBe(42);
    expect(send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);
    const missing = new S3ServiceException({ name: 'NotFound', $fault: 'client', $metadata: { httpStatusCode: 404 } });
    send.mockRejectedValueOnce(missing as never);
    await expect(store.size('abc')).resolves.toBeNull();
    const denied = new S3ServiceException({ name: 'AccessDenied', $fault: 'client', $metadata: { httpStatusCode: 403 } });
    send.mockRejectedValueOnce(denied as never);
    await expect(store.size('abc')).rejects.toThrow();
  });

  it('remove: DeleteObject con la clave del módulo', async () => {
    send.mockResolvedValue({} as never);
    await store.remove('abc');
    expect((send.mock.calls[0][0] as DeleteObjectCommand).input.Key).toBe('course-materials/abc');
  });

  it('signedUrl: SigV4 de corta duración, con nombre y tipo (antes un HeadObject mide el reloj del almacén)', async () => {
    send.mockResolvedValue({} as never);
    const url = new URL(await store.signedUrl('abc', { filename: 'clase 1.mp4', contentType: 'video/mp4', disposition: 'inline' }));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand); // [2026-10-19]: valida que el objeto existe y sincroniza el reloj
    expect(url.host).toBe('aula-prod.acc123.r2.cloudflarestorage.com'); // R2: estilo virtual (bucket como subdominio)
    expect(url.pathname).toBe('/course-materials/abc');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('response-content-disposition')).toBe("inline; filename*=UTF-8''clase%201.mp4");
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    expect(url.toString()).not.toContain(ENV.S3_SECRET_ACCESS_KEY);
  });

  it('signedUrl firma con la hora del almacén si su reloj va adelantado (evita «Request has expired»)', async () => {
    send.mockResolvedValue({} as never);
    const s3 = (store as unknown as { s3: S3Client }).s3;
    s3.config.systemClockOffset = 8 * 3600_000; // VM de Docker/WSL 8 h adelantada (caso real del 2026-10-19)
    const url = new URL(await store.signedUrl('abc', { filename: 'a.pdf', contentType: 'application/pdf', disposition: 'attachment' }));
    s3.config.systemClockOffset = 0;
    const amz = url.searchParams.get('X-Amz-Date')!; // 20261019T120000Z
    const signedAt = Date.UTC(+amz.slice(0, 4), +amz.slice(4, 6) - 1, +amz.slice(6, 8), +amz.slice(9, 11), +amz.slice(11, 13), +amz.slice(13, 15));
    expect(signedAt - Date.now()).toBeGreaterThan(7.9 * 3600_000);
  });

  it('MinIO: estilo de ruta y host público para el navegador', async () => {
    const minio = new S3ObjectStore(
      s3Settings({ ...ENV, S3_ENDPOINT: 'http://minio:9000', S3_PUBLIC_ENDPOINT: 'http://localhost:9900', S3_FORCE_PATH_STYLE: 'true', S3_REGION: 'us-east-1' }),
      'reports',
      60,
    );
    const url = new URL(await minio.signedUrl('r.pdf', { filename: 'r.pdf', contentType: 'application/pdf', disposition: 'attachment' }));
    expect(`${url.host}${url.pathname}`).toBe('localhost:9900/aula-prod/reports/r.pdf');
  });

  it('rechaza claves con path traversal', async () => {
    await expect(store.open('../secreto')).rejects.toThrow(/inválida/);
    await expect(store.remove('/abs')).rejects.toThrow(/inválida/);
  });
});

describe('S3FileStorage', () => {
  it('commit sube el temporal y lo borra; signedUrl delega en el almacén', async () => {
    const dir = mkdtempSync(join(tmpdir(), 's3fs-'));
    writeFileSync(join(dir, 'k1'), 'pdf');
    const store = { put: jest.fn(), size: jest.fn(), open: jest.fn(), remove: jest.fn(), signedUrl: jest.fn().mockResolvedValue('https://x') };
    const fs = new S3FileStorage(store, dir);
    await fs.commit('k1', 'application/pdf');
    expect(store.put).toHaveBeenCalledWith('k1', { path: join(dir, 'k1') }, 'application/pdf');
    await expect(fs.signedUrl('k1', { filename: 'a', contentType: 'b', disposition: 'inline' })).resolves.toBe('https://x');
    await fs.remove('k1');
    expect(store.remove).toHaveBeenCalledWith('k1');
  });
});

describe('LocalObjectStore', () => {
  const store = new LocalObjectStore(mkdtempSync(join(tmpdir(), 'los-')));

  it('put, size, open con rango y remove idempotente', async () => {
    await store.put('es/es-ES/a.wav', Buffer.from('0123456789'));
    await expect(store.size('es/es-ES/a.wav')).resolves.toBe(10);
    await expect(text(await store.open('es/es-ES/a.wav', { start: 3, end: 5 }))).resolves.toBe('345');
    await expect(store.signedUrl()).resolves.toBeNull();
    await store.remove('es/es-ES/a.wav');
    await store.remove('es/es-ES/a.wav');
    await expect(store.size('es/es-ES/a.wav')).resolves.toBeNull();
  });

  it('mueve el temporal de multer a su sitio definitivo', async () => {
    const tmp = join(mkdtempSync(join(tmpdir(), 'up-')), 'f');
    writeFileSync(tmp, 'x');
    await store.put('f', { path: tmp });
    await expect(store.size('f')).resolves.toBe(1);
  });

  it('rechaza path traversal', async () => {
    await expect(store.open('../../etc/passwd')).rejects.toThrow(/inválida/);
  });
});

describe('sendRanged con URL firmada', () => {
  it('302 al bucket, sin cachear, y sin abrir el flujo', async () => {
    const res = { setHeader: jest.fn(), redirect: jest.fn() };
    const open = jest.fn();
    await sendRanged(res as never, 'bytes=0-', { size: 10, contentType: 'video/mp4', open, signedUrl: 'https://bucket/x' });
    expect(res.redirect).toHaveBeenCalledWith(302, 'https://bucket/x');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
    expect(open).not.toHaveBeenCalled();
  });
});

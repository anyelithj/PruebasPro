import {
  CopyObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { s3Settings } from '../src/shared/config/storage.config';
import { S3ObjectStore } from '../src/shared/storage/s3-object.store';
// [Script de migración · Sprint 6.7]: lleva al bucket S3 (MinIO o Cloudflare R2) los archivos que hoy están en disco | [Patrón]: Batch Job idempotente | [Principio]: Fail Fast + KISS
// [Uso]: pnpm storage:migrate --dry-run   (solo muestra qué haría)
//        pnpm storage:migrate             (sube lo que falte; repetirlo no duplica nada)
//        pnpm storage:migrate --legacy-buckets   (además copia los buckets antiguos de MinIO: course-materials, pronunciation-audio y reports)
// [Idempotencia]: un objeto que ya existe con el mismo tamaño se salta | [Seguridad]: solo se imprimen claves, nunca credenciales

const PREFIXES = [
  'course-materials',
  'pronunciation-audio',
  'reports',
] as const; // Mismos prefijos que createObjectStore() en cada módulo
const MIME: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  wav: 'audio/wav',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const dryRun = process.argv.includes('--dry-run');
const legacy = process.argv.includes('--legacy-buckets');

// `process.loadEnvFile` (Node ≥ 20.12): lee .env sin dotenv; las variables ya exportadas tienen prioridad
for (const file of ['.env.local', '.env'])
  if (existsSync(file)) process.loadEnvFile(file);
const settings = s3Settings(); // Lanza con «VARIABLE: problema» si falta algo (sin mostrar valores)

// [walk]: rutas de todos los archivos bajo `dir` (recursivo, síncrono: es un script)
function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

async function migrateLocal(): Promise<void> {
  const root = resolve(process.env.UPLOADS_DIR ?? 'uploads');
  for (const prefix of PREFIXES) {
    const store = new S3ObjectStore(settings, prefix, 60);
    for (const file of walk(join(root, prefix))) {
      const key = relative(join(root, prefix), file).split(sep).join('/'); // Windows «\» → «/» de S3
      const size = statSync(file).size;
      if ((await store.size(key)) === size) {
        console.log(`= ya está   ${prefix}/${key}`);
        continue;
      }
      const type =
        MIME[key.split('.').pop()?.toLowerCase() ?? ''] ??
        'application/octet-stream'; // Los materiales no llevan extensión: el tipo real lo guarda la BD
      console.log(
        `${dryRun ? '~ subiría' : '↑ sube    '} ${prefix}/${key} (${size} B)`,
      );
      if (!dryRun) await store.put(key, { path: file }, type);
    }
  }
}

// [migrateLegacyBuckets]: MinIO del Sprint 6.6 tenía un bucket por módulo → se copian dentro del bucket único con su prefijo (CopyObject: sin descargar)
async function migrateLegacyBuckets(): Promise<void> {
  const s3 = new S3Client({
    endpoint: settings.S3_ENDPOINT,
    region: settings.S3_REGION,
    forcePathStyle: settings.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: settings.S3_ACCESS_KEY_ID,
      secretAccessKey: settings.S3_SECRET_ACCESS_KEY,
    },
  });
  for (const bucket of PREFIXES) {
    const store = new S3ObjectStore(settings, bucket, 60);
    let token: string | undefined;
    do {
      const page = await s3
        .send(
          new ListObjectsV2Command({
            Bucket: bucket,
            ContinuationToken: token,
          }),
        )
        .catch(() => undefined); // Bucket inexistente → nada que copiar
      for (const obj of page?.Contents ?? []) {
        if (!obj.Key || (await store.size(obj.Key)) === obj.Size) continue;
        console.log(
          `${dryRun ? '~ copiaría' : '⇢ copia   '} ${bucket}/${obj.Key} → ${settings.S3_BUCKET}/${bucket}/${obj.Key}`,
        );
        if (!dryRun)
          await s3.send(
            new CopyObjectCommand({
              Bucket: settings.S3_BUCKET,
              Key: `${bucket}/${obj.Key}`,
              CopySource: `${bucket}/${encodeURIComponent(obj.Key)}`,
            }),
          );
      }
      token = page?.NextContinuationToken;
    } while (token);
  }
}

// `void (async () => …)()`: punto de entrada; un error deja código de salida 1 (Fail Fast en CI)
void (async () => {
  console.log(
    `Destino: bucket ${settings.S3_BUCKET}${dryRun ? ' · SIMULACIÓN (no se escribe nada)' : ''}`,
  );
  await migrateLocal();
  if (legacy) await migrateLegacyBuckets();
  console.log('Listo.');
})().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

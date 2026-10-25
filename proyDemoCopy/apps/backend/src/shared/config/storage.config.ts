import { z } from 'zod';
// [Configuración de almacenamiento · Sprint 6.7]: STORAGE_PROVIDER=local|s3 y variables S3_* validadas con Zod al arrancar | [Patrón]: Configuration Object + Parse, don't validate | [Principio]: Fail Fast + SSOT (un solo lugar lee estas variables) | [Paradigma]: Funcional
// [Modos]: local = disco (UPLOADS_DIR) · s3 = MinIO en desarrollo o Cloudflare R2 en producción (misma API S3, solo cambian las variables)
// [Seguridad]: los mensajes de error nombran la variable, nunca su valor → las credenciales no llegan a los logs

// `z.enum([...]).transform` (Zod 4): las variables de entorno son texto → "true"/"false" a boolean (cualquier otro valor es error, no `false` silencioso)
const flag = z.enum(['true', 'false']).transform((v) => v === 'true');

// [Esquema común]: aplica en los dos modos | `z.coerce.number()` (Zod): "500" → 500
const CommonSchema = z.object({
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  UPLOADS_DIR: z.string().min(1).default('uploads'), // Disco local y carpeta temporal de multer
  MAX_UPLOAD_MB: z.coerce.number().int().positive().max(5000).default(500), // Tope por archivo (R2: 5 GiB por PUT; lib-storage sube por partes)
  S3_SIGNED_URL_TTL: z.coerce.number().int().min(60).max(604_800).default(900), // Segundos de vida de la URL firmada (R2: máx. 7 días)
  STORAGE_LOCAL_MIRROR: flag.default(true), // [2026-10-19]: con s3, guarda además una copia en UPLOADS_DIR (nube + local)
});

// [Esquema S3]: solo se exige con STORAGE_PROVIDER=s3 (o en el script de migración)
const S3Schema = z.object({
  S3_ENDPOINT: z.url(), // MinIO: http://localhost:9900 · R2: https://<ACCOUNT_ID>.r2.cloudflarestorage.com
  S3_PUBLIC_ENDPOINT: z.url().optional(), // Host que ve el navegador en las URL firmadas (Docker: el backend usa http://minio:9000, el navegador http://localhost:9900)
  S3_REGION: z.string().min(1).default('auto'), // R2 = "auto" · MinIO = "us-east-1"
  S3_BUCKET: z
    .string()
    .regex(
      /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/,
      'nombre de bucket S3 inválido',
    ), // Regla de nombres S3 (3-63, minúsculas)
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: flag.default(false), // true para MinIO (http://host/bucket/clave); R2 acepta ambos estilos
});

export type S3Settings = z.infer<typeof S3Schema>;
export interface StorageConfig {
  provider: 'local' | 's3';
  uploadsDir: string;
  maxUploadBytes: number;
  signedUrlTtl: number;
  localMirror: boolean;
  s3?: S3Settings; // Presente solo con provider = s3
}

// [parse]: lanza un Error con «VARIABLE: problema» por cada fallo | `z.prettifyError` no se usa porque incluye el valor recibido
function parse<T extends z.ZodType>(
  schema: T,
  env: NodeJS.ProcessEnv,
): z.infer<T> {
  // Variable vacía («S3_PUBLIC_ENDPOINT=») = no definida → aplica el valor por defecto u opcional
  const defined = Object.fromEntries(
    Object.entries(env).filter(([, v]) => v !== ''),
  );
  const result = schema.safeParse(defined);
  if (result.success) return result.data;
  const issues = result.error.issues.map(
    (i) => `${i.path.join('.')}: ${i.message}`,
  ); // Solo nombre + mensaje (sin valores)
  throw new Error(
    `Configuración de almacenamiento inválida → ${issues.join(' · ')}`,
  );
}

// [s3Settings]: variables S3 validadas (las usa también scripts/migrate-files-to-s3.ts)
export function s3Settings(env: NodeJS.ProcessEnv = process.env): S3Settings {
  return parse(S3Schema, env);
}

// [loadStorageConfig]: lectura pura del entorno → objeto tipado | [Paradigma]: Funcional (sin estado)
export function loadStorageConfig(
  env: NodeJS.ProcessEnv = process.env,
): StorageConfig {
  const common = parse(CommonSchema, env);
  return {
    provider: common.STORAGE_PROVIDER,
    uploadsDir: common.UPLOADS_DIR,
    maxUploadBytes: common.MAX_UPLOAD_MB * 1024 * 1024,
    signedUrlTtl: common.S3_SIGNED_URL_TTL,
    localMirror: common.STORAGE_LOCAL_MIRROR,
    s3: common.STORAGE_PROVIDER === 's3' ? s3Settings(env) : undefined,
  };
}

// [storageConfig]: memo por proceso (la configuración no cambia en caliente) | [Patrón]: Lazy Singleton
let cached: StorageConfig | undefined;
export function storageConfig(): StorageConfig {
  return (cached ??= loadStorageConfig());
}

// [validateStorageEnv]: gancho `validate` de ConfigModule.forRoot → el backend NO arranca con variables mal puestas | [Principio]: Fail Fast
export function validateStorageEnv(
  env: Record<string, unknown>,
): Record<string, unknown> {
  loadStorageConfig(env as NodeJS.ProcessEnv);
  return env;
}

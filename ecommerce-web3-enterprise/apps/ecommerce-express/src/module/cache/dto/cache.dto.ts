// cache.dto.ts (Zod + TypeScript) => contratos de entrada/salida del Cache Service (sprint 9.3).
// Patrón DTO + validación declarativa: el schema Zod valida en runtime y "z.infer" deriva el tipo (DRY: una fuente).
import { z } from "zod";

// CacheKeySchema => solo minúsculas, dígitos y ":_-." (evita claves basura y caracteres de glob en una clave exacta)
export const CacheKeySchema = z.string().regex(/^[a-z0-9:_.-]{1,200}$/, { message: "key: minúsculas, dígitos y : _ - . (máx. 200)" });

// Valor JSON con tope de 64 KB serializado: la caché L1 vive en RAM, no se aceptan blobs grandes
const MAX_VALUE_BYTES = 64 * 1024;
const JsonValueSchema = z
  .unknown()
  .refine((value) => value !== undefined, { message: "value es obligatorio" })
  .refine((value) => Buffer.byteLength(JSON.stringify(value) ?? "", "utf8") <= MAX_VALUE_BYTES, { message: "value supera 64 KB" });

const TtlSchema = z.coerce.number().int().min(1).max(86_400); // 1 s a 24 h

// SetCacheRequest => POST /api/v1/rt/cache
export const SetCacheRequestSchema = z.object({ key: CacheKeySchema, value: JsonValueSchema, ttl_seconds: TtlSchema.default(300) });
export type SetCacheRequest = z.infer<typeof SetCacheRequestSchema>;

// ReplaceCacheRequest => PUT /api/v1/rt/cache/:id (sin ttl_seconds conserva el TTL restante)
export const ReplaceCacheRequestSchema = z.object({ value: JsonValueSchema, ttl_seconds: TtlSchema.optional() });
export type ReplaceCacheRequest = z.infer<typeof ReplaceCacheRequestSchema>;

// PatternQuery => DELETE /api/v1/rt/cache?pattern=product:* (glob con * y ?)
export const PatternQuerySchema = z.object({ pattern: z.string().regex(/^[a-z0-9:_.*?-]{1,200}$/, { message: "pattern: glob con * y ?" }) });

// WarmupRequest => POST /api/v1/rt/cache/warmup (namespaces de la matriz)
export const WarmupNamespaces = ["product", "session", "inventory", "pricing"] as const;
export const WarmupRequestSchema = z.object({ namespace: z.enum(WarmupNamespaces), limit: z.coerce.number().int().min(1).max(500).default(100) });
export type WarmupRequest = z.infer<typeof WarmupRequestSchema>;
export type WarmupNamespace = (typeof WarmupNamespaces)[number];

// GetCacheResponse => nivel que respondió (L1 memoria < 1 ms, L2 Redis) y TTL restante
export interface GetCacheResponse {
  readonly key: string;
  readonly value: unknown;
  readonly source: "L1" | "L2";
  readonly ttlSeconds: number;
}

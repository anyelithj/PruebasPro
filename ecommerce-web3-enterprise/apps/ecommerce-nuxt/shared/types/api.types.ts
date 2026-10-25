// api.types.ts => contratos HTTP compartidos con Express y Next.js (paquete @ecommerce/shared-types: una sola fuente, DRY).
// "export type" => solo tipos: no generan JavaScript (0 bytes en el bundle).
import type { PaginationMeta } from "@ecommerce/shared-types";
export type { ApiError as ApiErrorBody, ApiResponse, ApiSuccess, PaginatedResponse, PaginationMeta } from "@ecommerce/shared-types";

// ApiResult<T> => lo que devuelve el cliente HTTP del proyecto: "data" ya desempaquetado + meta opcional (listados)
export interface ApiResult<T> {
  data: T;
  meta?: PaginationMeta | undefined;
  queued?: boolean; // RF-28.4 guardada sin conexión por el Service Worker (se enviará al volver la red)
}

// Query => valores admitidos en la query string (undefined/"" se omiten al construir la URL)
export type Query = Record<string, string | number | boolean | undefined | null>;

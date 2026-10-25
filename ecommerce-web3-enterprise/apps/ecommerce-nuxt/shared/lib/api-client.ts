// api-client.ts ($fetch / ofetch de Nuxt) => ÚNICO cliente REST hacia Express (patrón Gateway/Facade).
// Centraliza: URL base (interna en el servidor, pública en el navegador), token Bearer, idioma, query string,
// desempaquetado del sobre { success, data, meta } y errores tipados. Sin Axios ni Apollo: $fetch ya viene con
// Nuxt (0 KB extra) y useAsyncData deduplica las peticiones del SSR.
import { useCookie, useNuxtApp, useRuntimeConfig } from "#imports";
import type { ApiResult, Query } from "../types/api.types";
import { AUTH_COOKIES } from "./auth-config";
import { deviceId } from "./device-id";

// deviceHeader => RF-08.11 huella del dispositivo (solo en el navegador; en SSR no hay dispositivo del cliente)
const deviceHeader = async (): Promise<Record<string, string>> => {
  const id = await deviceId();
  return id ? { "X-Device-Id": id } : {};
};

// ApiError => error tipado con status HTTP y código estable del backend (la UI traduce por código)
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors?: Array<{ path: string; message: string }>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
interface Envelope<T> {
  success: boolean;
  data: T;
  queued?: boolean; // RF-28.4 el Service Worker la guardó sin conexión (se enviará al volver la red)
  meta?: ApiResult<T>["meta"];
  code?: string;
  message?: string;
  errors?: Array<{ path: string; message: string }>;
}

// cleanQuery => quita undefined/null/"" (URLs canónicas y cacheables). Función pura.
const cleanQuery = (query: Query = {}) => Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== ""));

// useApi => se llama en setup()/composables: captura config, cookie e idioma DENTRO del contexto de Nuxt y devuelve
// funciones que se pueden usar después en eventos o acciones de Pinia (Closure).
// "anonymous" => SIN token: obligatorio en páginas públicas con ISR (la respuesta se guarda en una caché compartida y
// nunca debe contener lo que solo ve un administrador, como borradores).
export function useApi(settings: { anonymous?: boolean } = {}) {
  const config = useRuntimeConfig();
  const cookie = useCookie<string | null>(AUTH_COOKIES.access);
  const token = { get value() { return settings.anonymous ? null : cookie.value; } }; // getter: lee la cookie al momento de cada petición
  const locale = (useNuxtApp().$i18n as { locale?: { value: string } } | undefined)?.locale;
  // "import.meta.server" => en SSR se usa la red interna (Docker); en el navegador la URL pública
  const baseURL = import.meta.server ? config.apiInternalUrl : config.public.apiUrl;

  async function request<T>(method: Method, path: string, options: { body?: unknown; query?: Query } = {}): Promise<ApiResult<T>> {
    // RF-28.7 cada operación que modifica datos lleva su clave: el reintento (SW o usuario) no la duplica en Express
    const idempotency: Record<string, string> = method !== "GET" && import.meta.client ? { "Idempotency-Key": crypto.randomUUID() } : {};
    try {
      const envelope = await $fetch<Envelope<T> | undefined>(path, {
        method,
        baseURL,
        query: cleanQuery(options.query),
        // FormData viaja tal cual (multipart); los objetos se serializan a JSON (ofetch)
        ...(options.body !== undefined ? { body: options.body as Record<string, unknown> } : {}),
        headers: { Accept: "application/json", ...idempotency, ...(locale?.value ? { "Accept-Language": locale.value } : {}), ...(token.value ? { Authorization: `Bearer ${token.value}` } : {}), ...(await deviceHeader()) },
      });
      if (!envelope) return { data: undefined as T }; // 204 No Content
      return { data: envelope.data, meta: envelope.meta, ...(envelope.queued ? { queued: true } : {}) };
    } catch (error) {
      throw toApiError(error);
    }
  }

  return {
    get: <T>(path: string, query?: Query) => request<T>("GET", path, query ? { query } : {}),
    post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body }),
    patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body }),
    put: <T>(path: string, body?: unknown) => request<T>("PUT", path, { body }),
    del: <T = void>(path: string, body?: unknown) => request<T>("DELETE", path, body === undefined ? {} : { body }),
  };
}

export type Api = ReturnType<typeof useApi>;

// toApiError => FetchError de ofetch -> ApiError con el código del backend (Adapter)
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const failure = error as { status?: number; statusCode?: number; data?: Envelope<unknown> };
  const status = failure.status ?? failure.statusCode ?? 0;
  const body = failure.data;
  return new ApiError(status, body?.code ?? (status ? `HTTP_${status}` : "NETWORK_ERROR"), body?.message ?? "No se pudo completar la solicitud", body?.errors);
}

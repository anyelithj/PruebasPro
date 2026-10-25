// [FACADE][DRY] wrapper tipado de $fetch — oculta baseURL, auth header y desempaquetado.
// [STRATEGY] elige backend (Nest | FastAPI) por runtimeConfig o override explícito.
import { useRuntimeConfig, useCookie } from '#app';
import type { ApiEnvelope, ApiProvider } from '~/shared/api/contracts';

type ReqOptions = Record<string, unknown>;

function unwrap<T>(res: unknown): T {
  // Ambos backends responden { success, data, message }. Si no, se devuelve tal cual.
  if (res && typeof res === 'object' && 'success' in (res as ApiEnvelope<T>)) {
    const env = res as ApiEnvelope<T>;
    if (!env.success) {
      const msg = env.error?.message ?? env.message ?? 'Request failed';
      throw new Error(msg);
    }
    return env.data as T;
  }
  return res as T;
}

export function useApi(providerOverride?: ApiProvider) {
  const config = useRuntimeConfig();
  const provider: ApiProvider =
    providerOverride ?? ((config.public.apiProvider as ApiProvider) || 'nest');
  const baseURL =
    provider === 'fastapi'
      ? (config.public.fastapiBaseUrl as string)
      : (config.public.nestBaseUrl as string);

  const accessToken = useCookie<string | null>('access_token');

  function authHeaders(): Record<string, string> {
    return accessToken.value ? { Authorization: `Bearer ${accessToken.value}` } : {};
  }

  async function request<T>(path: string, opts: ReqOptions = {}): Promise<T> {
    const res = await $fetch(path, {
      baseURL,
      headers: { ...authHeaders(), ...((opts.headers as Record<string, string>) ?? {}) },
      ...opts,
    });
    return unwrap<T>(res);
  }

  return {
    provider,
    baseURL,
    request,
    get: <T>(path: string, opts?: ReqOptions) => request<T>(path, { method: 'GET', ...opts }),
    post: <T>(path: string, body?: unknown, opts?: ReqOptions) =>
      request<T>(path, { method: 'POST', body, ...opts }),
    patch: <T>(path: string, body?: unknown, opts?: ReqOptions) =>
      request<T>(path, { method: 'PATCH', body, ...opts }),
    del: <T>(path: string, opts?: ReqOptions) => request<T>(path, { method: 'DELETE', ...opts }),
  };
}

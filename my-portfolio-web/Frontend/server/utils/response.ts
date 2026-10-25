// [DRY] formato estándar de respuesta del BFF — mismo envelope que los backends.
export interface BffEnvelope<T> {
  success: boolean;
  data: T | null;
  message?: string;
}

export function ok<T>(data: T, message?: string): BffEnvelope<T> {
  return { success: true, data, message };
}

export function fail(message: string): BffEnvelope<null> {
  return { success: false, data: null, message };
}

// Resuelve la base URL privada del backend elegido (para SSR/Nitro).
export function resolveBackendBase(
  provider: string,
  config: { fastapiBaseUrl: string; nestBaseUrl: string },
): string {
  return provider === 'fastapi' ? config.fastapiBaseUrl : config.nestBaseUrl;
}

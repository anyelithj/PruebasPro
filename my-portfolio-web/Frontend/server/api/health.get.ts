// [SRP] health-check agregado — consulta AMBOS backends (Nest + FastAPI) y reporta estado.
import { defineEventHandler } from 'h3';
import { useRuntimeConfig } from '#imports';
import { ok } from '../utils/response';

async function ping(base: string): Promise<{ up: boolean; detail?: unknown }> {
  try {
    // /health vive fuera del prefijo /api/v1 → subimos un nivel.
    const root = base.replace(/\/api\/v1\/?$/, '');
    const res = await $fetch(`${root}/health`, { timeout: 2500 });
    return { up: true, detail: res };
  } catch (e) {
    return { up: false, detail: (e as Error).message };
  }
}

export default defineEventHandler(async () => {
  const config = useRuntimeConfig();
  const [nest, fastapi] = await Promise.all([
    ping(config.nestBaseUrl as string),
    ping(config.fastapiBaseUrl as string),
  ]);
  return ok({ nest, fastapi });
});

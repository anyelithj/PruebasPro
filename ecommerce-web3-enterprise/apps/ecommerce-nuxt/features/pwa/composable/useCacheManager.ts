// useCacheManager.ts (Composable + Cache Storage API + StorageManager) => inspecciona y limpia las cachés del Service
// Worker: entradas por caché, uso total del almacenamiento y cuota. Limpiar libera espacio del dispositivo.
// Patrón Strategy (cada caché tiene su estrategia en sw/cache-strategies.ts; aquí se muestra cuál) + Facade.
import { ref } from "vue";
import type { CacheInfo } from "~~/entities/pwa/model/pwa.types";
import { CACHE_NAMES } from "~~/shared/constants/config";
import { clearableCache } from "../lib/pwa.validator";

// STRATEGY_OF => etiqueta de la estrategia de Workbox por caché (para la tabla del panel)
export const STRATEGY_OF: Record<string, string> = { [CACHE_NAMES.images]: "CacheFirst", [CACHE_NAMES.api]: "NetworkFirst", [CACHE_NAMES.pages]: "NetworkFirst" };

export function useCacheManager() {
  const caches_ = ref<CacheInfo[]>([]);
  const usage = ref<{ used: number; quota: number } | null>(null);
  const loading = ref(false);

  async function refresh(): Promise<void> {
    if (typeof caches === "undefined") return;
    loading.value = true;
    try {
      const names = await caches.keys();
      // Solo se cuentan las claves (no se leen los cuerpos: nada se carga en memoria)
      caches_.value = await Promise.all(names.map(async (name) => ({ name, entries: (await (await caches.open(name)).keys()).length })));
      const estimate = await navigator.storage?.estimate?.();
      usage.value = estimate ? { used: estimate.usage ?? 0, quota: estimate.quota ?? 0 } : null;
    } finally {
      loading.value = false;
    }
  }

  // clear => borra una caché de la lista blanca (la precarga de Workbox no se toca); sin nombre => todas las permitidas
  async function clear(name?: string): Promise<void> {
    const targets = name ? [clearableCache.parse(name)] : clearableCache.options;
    await Promise.all(targets.map((target) => caches.delete(target)));
    await refresh();
  }

  return { caches: caches_, usage, loading, refresh, clear };
}

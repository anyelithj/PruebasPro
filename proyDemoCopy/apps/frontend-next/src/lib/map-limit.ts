// [mapLimit · 2026-10-27]: `Promise.all` con como máximo `limit` promesas a la vez y resultados en el MISMO orden | [Patrón]: Bounded Parallelism (estilo p-limit, sin dependencia) | [Principio]: DRY + KISS | [Paradigma]: Funcional + async/await
// Uso: varias peticiones independientes al BFF/NestJS (conceptos de Poliglota, recursos de un tema) → ~`limit`× más rápido que `for…of` + `await`, sin disparar el throttler ni saturar FastAPI
export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length); // Por índice → orden estable aunque terminen desordenadas
  let next = 0; // Índice compartido entre «carriles» (JS es monohilo: sin carreras entre `await`)
  const lane = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  // `Array.from({ length })` (ES2015): `limit` carriles, nunca más que elementos
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, lane));
  return out;
}

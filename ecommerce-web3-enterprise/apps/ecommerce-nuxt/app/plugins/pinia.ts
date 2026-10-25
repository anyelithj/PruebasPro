// pinia.ts (plugin de Nuxt + Pinia) => extiende TODOS los stores con "$reset" también para los setup stores (Pinia
// solo lo trae en los option stores). Patrón Decorator: agrega comportamiento sin tocar cada store; Singleton: un
// pinia por petición (SSR) o por pestaña (navegador), lo crea @pinia/nuxt.
import type { Pinia, PiniaPluginContext } from "pinia";

export default defineNuxtPlugin((nuxtApp) => {
  const pinia = nuxtApp.$pinia as Pinia;
  pinia.use(({ store }: PiniaPluginContext) => {
    // Copia del estado inicial (JSON: los stores solo guardan datos serializables) y structuredClone NATIVO al
    // restaurar (cada $reset parte de una copia nueva; sin lodash)
    const initial = JSON.parse(JSON.stringify(store.$state)) as Record<string, unknown>;
    store.$reset = () => store.$patch((state) => Object.assign(state, structuredClone(initial)));
  });
});

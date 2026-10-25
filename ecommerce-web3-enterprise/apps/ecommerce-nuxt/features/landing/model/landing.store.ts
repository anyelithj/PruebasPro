// landing.store.ts (Pinia, setup store) => Client State de las landings: en qué landings ya se suscribió el visitante
// en esta pestaña (se muestra el agradecimiento en lugar del formulario) y si el formulario se está enviando.
// Los datos de la landing son Server State (useAsyncData). Patrones: Observer + Singleton.
import { defineStore } from "pinia";
import { ref } from "vue";

export const useLandingStore = defineStore("landing", () => {
  const subscribed = ref<string[]>([]); // Slugs de las landings con lead enviado
  const markSubscribed = (slug: string) => {
    if (!subscribed.value.includes(slug)) subscribed.value.push(slug);
  };
  const isSubscribed = (slug: string) => subscribed.value.includes(slug);
  return { subscribed, markSubscribed, isSubscribed };
});

// social.store.ts (Pinia, setup store) => Client State del comercio social: plataforma filtrada en el feed, tasa de
// comisión para influencers (configurable en la vista) y enlaces de compra generados en la sesión.
// Las publicaciones y métricas son Server State (useAsyncData). Patrones: Observer + Singleton.
import { defineStore } from "pinia";
import { ref } from "vue";
import type { SocialPlatform } from "~~/entities/social/model/social.types";

export const useSocialStore = defineStore("social", () => {
  const platform = ref<SocialPlatform | "">("");
  const commissionRate = ref(0.1); // 10 % por defecto (editable por el administrador en la vista)
  const links = ref<Array<{ url: string; createdAt: string }>>([]);

  const setPlatform = (value: SocialPlatform | "") => (platform.value = value);
  const setCommissionRate = (value: number) => (commissionRate.value = Math.min(Math.max(value, 0), 0.5)); // 0–50 %
  const addLink = (url: string) => (links.value = [{ url, createdAt: new Date().toISOString() }, ...links.value].slice(0, 10));

  return { platform, commissionRate, links, setPlatform, setCommissionRate, addLink };
});

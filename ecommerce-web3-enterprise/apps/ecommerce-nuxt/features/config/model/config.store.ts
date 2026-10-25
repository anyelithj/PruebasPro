// config.store.ts (Pinia, setup store) => Client State de la configuración: qué secciones tienen cambios sin guardar
// (aviso al salir) y la última sección guardada (mensaje de confirmación). Los valores son Server State
// (useStoreConfig con useAsyncData). Patrones: Observer + Singleton.
import { defineStore } from "pinia";
import { ref } from "vue";
import type { ConfigSection } from "~~/entities/pwa/model/pwa.types";

export const useConfigStore = defineStore("config", () => {
  const dirty = ref<ConfigSection[]>([]);
  const lastSaved = ref<{ section: ConfigSection; at: string } | null>(null);

  const setDirty = (section: ConfigSection, value: boolean) => {
    dirty.value = value ? [...new Set([...dirty.value, section])] : dirty.value.filter((item) => item !== section);
  };
  const markSaved = (section: ConfigSection) => {
    setDirty(section, false);
    lastSaved.value = { section, at: new Date().toISOString() };
  };

  return { dirty, lastSaved, setDirty, markSaved };
});

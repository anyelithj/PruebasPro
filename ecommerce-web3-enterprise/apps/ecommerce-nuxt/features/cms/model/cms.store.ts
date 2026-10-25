// cms.store.ts (Pinia, setup store) => Client State del editor CMS: dispositivo de vista previa, cambios sin
// guardar y pestaña (tipo de contenido) del listado. Los documentos son Server State (useAsyncData): aquí no se
// copian. Patrones: Observer (estado reactivo) + Singleton (un store por pestaña / por petición en SSR).
import { defineStore } from "pinia";
import { ref } from "vue";
import type { ContentKind } from "~~/entities/cms/model/cms.types";

export type PreviewDevice = "desktop" | "tablet" | "mobile";
// ListKind => pestañas del listado del CMS: los 4 tipos de contenido + colecciones del catálogo (unión de literales)
export type ListKind = ContentKind | "collection";
export const DEVICE_WIDTH: Record<PreviewDevice, string> = { desktop: "100%", tablet: "768px", mobile: "375px" };

export const useCmsStore = defineStore("cms", () => {
  const device = ref<PreviewDevice>("desktop");
  const dirty = ref(false); // true => hay cambios en el lienzo sin guardar (aviso al salir)
  const listKind = ref<ListKind>("page"); // Pestaña activa en /cms-page (listado ÚNICO del CMS)

  const setDevice = (value: PreviewDevice) => (device.value = value);
  const markDirty = (value = true) => (dirty.value = value);
  const setListKind = (value: ListKind) => (listKind.value = value);

  return { device, dirty, listKind, setDevice, markDirty, setListKind };
});

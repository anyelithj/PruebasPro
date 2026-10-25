// seo.store.ts (Pinia, setup store) => Client State de las secciones SEO: vista del blog (cuadrícula/lista) y si el
// listado de eventos incluye los pasados. Los filtros de categoría/etiqueta van en la URL (compartibles e
// indexables), no aquí. Patrones: Observer + Singleton.
import { defineStore } from "pinia";
import { ref } from "vue";

export const useSeoStore = defineStore("seo", () => {
  const blogView = ref<"grid" | "list">("grid");
  const toggleBlogView = () => (blogView.value = blogView.value === "grid" ? "list" : "grid");
  return { blogView, toggleBlogView };
});

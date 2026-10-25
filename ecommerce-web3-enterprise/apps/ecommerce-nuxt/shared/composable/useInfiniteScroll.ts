// useInfiniteScroll.ts (VueUse + Composition API) => listado paginado que carga la página siguiente al acercarse al
// final (IntersectionObserver sobre un "centinela", sin escuchar el scroll en cada píxel: menos CPU y batería).
// Genérico <T>: sirve para blog, lookbooks y productos sociales (DRY). Patrón Observer + Iterator (página a página).
import { ref, shallowRef, type Ref } from "vue";
import { useIntersectionObserver } from "@vueuse/core";
import type { ApiResult } from "../types/api.types";

export function useInfiniteList<T>(loadPage: (page: number) => Promise<ApiResult<T[]>>, initial: T[] = [], initialTotalPages = 1) {
  const items = shallowRef<T[]>(initial); // shallowRef => sin reactividad profunda en cada ítem (menos memoria)
  const page = ref(1);
  const totalPages = ref(initialTotalPages);
  const loading = ref(false);
  const sentinel: Ref<HTMLElement | null> = ref(null); // Elemento al final de la lista (ref en el template)

  async function loadMore(): Promise<void> {
    if (loading.value || page.value >= totalPages.value) return;
    loading.value = true;
    try {
      const result = await loadPage(page.value + 1);
      items.value = [...items.value, ...result.data];
      page.value += 1;
      totalPages.value = result.meta?.totalPages ?? page.value;
    } finally {
      loading.value = false;
    }
  }

  // rootMargin => empieza a cargar 300 px antes de llegar al final (sin esperas visibles)
  useIntersectionObserver(sentinel, ([entry]) => entry?.isIntersecting && void loadMore(), { rootMargin: "300px" });

  return { items, page, totalPages, loading, sentinel, loadMore };
}

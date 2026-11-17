// useLocalPage.ts (Composable) => paginación en el navegador para listas que llegan completas: máximo 10 filas por vista en
// todas las tablas del panel (espejo de useLocalPage de Next.js, DataTable.tsx). Lo consumen DataTable.vue y TablePager.vue.
import { computed, ref, toValue, type MaybeRefOrGetter } from "vue";
import type { PaginationMeta } from "../types/api.types";

export const LOCAL_PAGE = 10;

export function useLocalPage<T>(rows: MaybeRefOrGetter<readonly T[] | null | undefined>) {
  const page = ref(1);
  const total = computed(() => toValue(rows)?.length ?? 0);
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / LOCAL_PAGE)));
  const current = computed(() => Math.min(page.value, totalPages.value)); // La lista pudo encogerse (filtro, recarga)
  const visible = computed(() => toValue(rows)?.slice((current.value - 1) * LOCAL_PAGE, current.value * LOCAL_PAGE) ?? []);
  const meta = computed(() => ({ page: current.value, totalPages: totalPages.value, total: total.value, limit: LOCAL_PAGE }) as PaginationMeta);
  return { page, visible, meta };
}

// [SRP] bandeja de contacto del admin contra el backend activo (Nest | FastAPI).
// Usa useApi (envía Bearer del access_token) y el provider elegido en el auth store.
import { computed, ref } from 'vue';
import { useApi } from '~/composables/useApi';
import { useAuthStore } from '~/stores/useAuthStore';
import type { ContactStatus, ContactSubmission, Paginated } from '~/shared/api/contracts';

export function useContactAdmin() {
  const auth = useAuthStore();
  const items = ref<ContactSubmission[]>([]);
  const total = ref(0);
  const page = ref(1);
  const pageSize = ref(20);
  const status = ref<ContactStatus | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const pending = computed(() => items.value.filter((i) => i.status === 'pending').length);

  function api() {
    return useApi(auth.provider);
  }

  async function run<T>(fn: () => Promise<T>): Promise<T> {
    loading.value = true;
    error.value = null;
    try {
      return await fn();
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  // Nest espera ?page&pageSize&status; FastAPI ?page&page_size&contact_status.
  function queryFor(provider: string): Record<string, string | number> {
    const base =
      provider === 'fastapi'
        ? { page: page.value, page_size: pageSize.value }
        : { page: page.value, pageSize: pageSize.value };
    if (!status.value) return base;
    return provider === 'fastapi'
      ? { ...base, contact_status: status.value }
      : { ...base, status: status.value };
  }

  async function fetchAll(): Promise<void> {
    await run(async () => {
      const res = await api().get<Paginated<ContactSubmission>>('/contact', {
        query: queryFor(auth.provider),
      });
      items.value = res.items;
      total.value = res.meta.total;
    });
  }

  async function setStatus(id: string, next: ContactStatus): Promise<void> {
    await run(async () => {
      await api().patch<ContactSubmission>(`/contact/${id}`, { status: next });
      await fetchAll();
    });
  }

  async function remove(id: string): Promise<void> {
    await run(async () => {
      await api().del(`/contact/${id}`);
      await fetchAll();
    });
  }

  async function filterBy(next: ContactStatus | null): Promise<void> {
    status.value = next;
    page.value = 1;
    await fetchAll();
  }

  return {
    items,
    total,
    page,
    pageSize,
    status,
    pending,
    loading,
    error,
    fetchAll,
    setStatus,
    remove,
    filterBy,
  };
}

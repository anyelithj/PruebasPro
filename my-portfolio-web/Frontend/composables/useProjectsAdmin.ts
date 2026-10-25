// [SRP] CRUD admin de proyectos contra el backend activo (Nest | FastAPI).
// Usa useApi (envía Bearer del access_token) y el provider elegido en el auth store.
import { ref } from 'vue';
import { useApi } from '~/composables/useApi';
import { useAuthStore } from '~/stores/useAuthStore';
import type { AdminProject } from '~/shared/api/contracts';
import type { CreateProjectInput, UpdateProjectInput } from '~/shared/schemas/project-admin.schema';

export function useProjectsAdmin() {
  const auth = useAuthStore();
  const items = ref<AdminProject[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

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

  async function fetchAll(): Promise<void> {
    await run(async () => {
      items.value = await api().get<AdminProject[]>('/projects');
    });
  }

  async function create(input: CreateProjectInput): Promise<void> {
    await run(async () => {
      await api().post<AdminProject>('/projects', input);
      await fetchAll();
    });
  }

  async function update(id: string, input: UpdateProjectInput): Promise<void> {
    await run(async () => {
      await api().patch<AdminProject>(`/projects/${id}`, input);
      await fetchAll();
    });
  }

  async function remove(id: string): Promise<void> {
    await run(async () => {
      await api().del(`/projects/${id}`);
      await fetchAll();
    });
  }

  return { items, loading, error, fetchAll, create, update, remove };
}

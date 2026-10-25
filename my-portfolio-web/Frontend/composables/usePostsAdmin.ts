// [SRP] CRUD admin del blog contra el backend Nest (/posts). Bearer vía useApi.
import { ref } from 'vue';
import { useApi } from '~/composables/useApi';
import { useAuthStore } from '~/stores/useAuthStore';
import type { BlogPost } from '~/shared/api/contracts';
import type { CreatePostInput, UpdatePostInput } from '~/shared/schemas/post-admin.schema';

export function usePostsAdmin() {
  const auth = useAuthStore();
  const items = ref<BlogPost[]>([]);
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
      items.value = await api().get<BlogPost[]>('/posts/admin');
    });
  }

  function getOne(id: string): Promise<BlogPost> {
    return run(() => api().get<BlogPost>(`/posts/${id}`));
  }

  async function create(input: CreatePostInput): Promise<void> {
    await run(async () => {
      await api().post<BlogPost>('/posts', input);
      await fetchAll();
    });
  }

  async function update(id: string, input: UpdatePostInput): Promise<void> {
    await run(async () => {
      await api().patch<BlogPost>(`/posts/${id}`, input);
      await fetchAll();
    });
  }

  async function remove(id: string): Promise<void> {
    await run(async () => {
      await api().del(`/posts/${id}`);
      await fetchAll();
    });
  }

  return { items, loading, error, fetchAll, getOne, create, update, remove };
}

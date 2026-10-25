// [ML] Clasificación de mensajes de contacto vía FastAPI (/ml/contact/classify).
import { ref } from 'vue';
import { useApi } from '~/composables/useApi';
import type { ContactClassification } from '~/shared/api/contracts';

export function useContactClassify() {
  const result = ref<ContactClassification | null>(null);
  const loading = ref(false);

  async function classify(message: string): Promise<ContactClassification | null> {
    const msg = message.trim();
    if (!msg) return null;
    loading.value = true;
    try {
      const r = await useApi('fastapi').post<ContactClassification>('/ml/contact/classify', {
        message: msg,
      });
      result.value = r;
      return r;
    } catch {
      // La clasificación es best-effort: si falla, no rompe el envío del contacto.
      result.value = null;
      return null;
    } finally {
      loading.value = false;
    }
  }

  return { result, loading, classify };
}

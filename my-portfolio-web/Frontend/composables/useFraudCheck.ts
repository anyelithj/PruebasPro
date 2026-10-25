// [ML] Detección de fraude en wallets vía FastAPI (/ml/fraud/wallet).
// ML vive siempre en FastAPI (backend de IA/ML), sin importar el provider principal.
import { ref } from 'vue';
import { useApi } from '~/composables/useApi';
import type { FraudResult } from '~/shared/api/contracts';

export function useFraudCheck() {
  const result = ref<FraudResult | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function analyze(address: string, chain?: string): Promise<FraudResult | null> {
    const addr = address.trim();
    if (!addr) {
      result.value = null;
      return null;
    }
    loading.value = true;
    error.value = null;
    try {
      const r = await useApi('fastapi').post<FraudResult>('/ml/fraud/wallet', {
        address: addr,
        chain,
      });
      result.value = r;
      return r;
    } catch (e) {
      error.value = (e as Error).message;
      result.value = null;
      return null;
    } finally {
      loading.value = false;
    }
  }

  function reset(): void {
    result.value = null;
    error.value = null;
  }

  return { result, loading, error, analyze, reset };
}

// useStoreConfig.ts (Composable + useAsyncData + Pinia) => carga UNA vez la configuración de la tienda (clave
// compartida "store-config": los cuatro formularios reutilizan la misma respuesta), expone cada sección con valores
// por defecto y guarda una sección refrescando solo esa consulta. Patrón Facade + Observer.
import { computed } from "vue";
import type { ConfigSection, CurrencyConfig, PaymentConfig, ReturnsConfig, ShippingConfig, TaxConfig } from "~~/entities/pwa/model/pwa.types";
import type { HelpConfig } from "~~/features/store/lib/help.validator";
import { useApi } from "~~/shared/lib/api-client";
import { useToast } from "~~/shared/composable/useToast";
import { configApi } from "../api/config.api";
import { useConfigStore } from "../model/config.store";

// DEFAULTS => valores iniciales cuando la sección aún no se ha guardado (tienda nueva)
const DEFAULTS = {
  payment: { stripe: { enabled: true }, crypto: { enabled: false, networks: [] }, cashOnDelivery: false } satisfies PaymentConfig,
  shipping: { carriers: [], freeShippingOverCents: null } satisfies ShippingConfig,
  tax: { pricesIncludeTax: true, rates: [{ region: "Colombia", rate: 0.19 }] } satisfies TaxConfig,
  currency: { default: "COP", supported: ["COP", "USD"] } satisfies CurrencyConfig,
  returns: { windowDays: 30, requirePhotos: true } satisfies ReturnsConfig, // RF-12.6
  help: { faq: [] } satisfies HelpConfig, // RF-21.2
};
type Sections = typeof DEFAULTS;

export function useStoreConfig() {
  const api = configApi(useApi());
  const store = useConfigStore();
  const toast = useToast();
  const { t } = useI18n();
  const { data, pending, refresh } = useAsyncData("store-config", () => api.all(), { server: false });

  // section => valor guardado o el de por defecto (computed: reacciona al refrescar)
  const section = <S extends ConfigSection>(name: S) => computed(() => ({ ...DEFAULTS[name], ...(data.value?.find((entry) => entry.section === name)?.value ?? {}) }) as Sections[S]);

  async function save(name: ConfigSection, value: Record<string, unknown>): Promise<void> {
    try {
      await api.save(name, value);
      store.markSaved(name);
      toast.success(t("config.saved"));
      await refresh();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return { section, save, pending, store };
}

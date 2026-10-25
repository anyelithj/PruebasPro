// config.api.ts => Repository de la configuración global contra Express (/cms/config): lectura completa para staff y
// guardado por sección (PUT reemplaza la sección: idempotente). Inyección del cliente "api".
import type { Api } from "~~/shared/lib/api-client";
import type { ConfigSection, StoreConfigEntry } from "~~/entities/pwa/model/pwa.types";

export function configApi(api: Api) {
  return {
    all: async () => (await api.get<StoreConfigEntry[]>("/cms/config")).data,
    save: async (section: ConfigSection, value: Record<string, unknown>) => (await api.put<StoreConfigEntry>(`/cms/config/${section}`, value)).data,
  };
}

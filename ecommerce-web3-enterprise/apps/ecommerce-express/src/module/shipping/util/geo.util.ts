// geo.util.ts (Axios + OpenStreetMap Nominatim) => geocodificación gratuita y sin llave para:
//  - RF-08.2 autocompletado de direcciones en el checkout (texto -> sugerencias con ciudad, departamento y código postal)
//  - RF-09.1 / RF-10.5 mapa del paquete (ciudad del último evento de rastreo -> coordenadas)
// Política de uso de Nominatim: identificarse con User-Agent, máximo ~1 petición/s y cachear => cada consulta se
// guarda 7 días en Redis (Cache-Aside) y el frontend espera a que el usuario deje de escribir (debounce).
// Patrón Adapter (respuesta de Nominatim -> tipos propios). Degradación: si el servicio falla se devuelve [] / null.
import axios from "axios";
import { appConfig } from "../../../config/app.config";
import { RedisKeys } from "../../../config/redis.config";
import { cached } from "../../../shared/interceptor/cache.interceptor";
import { logger } from "../../../shared/middleware/logger.middleware";

const GEO_TTL_SECONDS = 7 * 24 * 60 * 60; // Las direcciones y ciudades casi no cambian
const TIMEOUT_MS = 5_000;
const http = axios.create({ baseURL: appConfig.NOMINATIM_URL, timeout: TIMEOUT_MS, headers: { "User-Agent": "eCommerce-Web3/1.0 (portfolio)" } });

export interface AddressSuggestion {
  label: string; // Texto completo para mostrar en la lista
  line1: string; // Calle y número
  city: string;
  state: string;
  postalCode: string;
  country: string; // ISO alpha-2
  latitude: number;
  longitude: number;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
  label: string;
}

// NominatimPlace => campos que se usan de la respuesta (jsonv2 + addressdetails)
interface NominatimPlace {
  lat: string;
  lon: string;
  display_name: string;
  address?: Partial<Record<"road" | "house_number" | "city" | "town" | "village" | "municipality" | "state" | "postcode" | "country_code", string>>;
}

// search => una sola vía de acceso (DRY): consulta cacheada; errores => [] (la UI sigue funcionando sin sugerencias)
async function search(q: string, limit: number, country?: string): Promise<NominatimPlace[]> {
  const key = RedisKeys.catalog("geo", `${country ?? "any"}:${limit}:${q.toLowerCase()}`);
  return cached(key, GEO_TTL_SECONDS, async () => {
    try {
      const { data } = await http.get<NominatimPlace[]>("/search", { params: { q, format: "jsonv2", addressdetails: 1, limit, ...(country ? { countrycodes: country } : {}) } });
      return data;
    } catch (error) {
      logger.warn("geocoding_unavailable", { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  });
}

// suggestAddresses => RF-08.2 sugerencias para el formulario de dirección (Colombia por defecto)
export async function suggestAddresses(q: string, country = "co"): Promise<AddressSuggestion[]> {
  return (await search(q, 5, country)).map((place) => {
    const address = place.address ?? {};
    return {
      label: place.display_name,
      line1: [address.road, address.house_number].filter(Boolean).join(" # ") || place.display_name.split(",")[0] || "",
      city: address.city ?? address.town ?? address.village ?? address.municipality ?? "",
      state: address.state ?? "",
      postalCode: address.postcode ?? "",
      country: (address.country_code ?? country).toUpperCase(),
      latitude: Number(place.lat),
      longitude: Number(place.lon),
    };
  });
}

// geocode => coordenadas de una ciudad/lugar (null si no se encuentra)
export async function geocode(q: string): Promise<GeoPoint | null> {
  const [place] = await search(q, 1);
  return place ? { latitude: Number(place.lat), longitude: Number(place.lon), label: place.display_name } : null;
}

// pwa.types.ts (TypeScript estricto) => tipos de la PWA: evento de instalación (no está en lib.dom), estado del
// Service Worker, cachés de Workbox y configuración global de la tienda (Express /cms/config).

// BeforeInstallPromptEvent => evento de Chromium para instalar la app (tipado a mano: no es estándar del DOM)
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export type InstallState = "unsupported" | "available" | "installed" | "dismissed";

// CacheInfo => una caché del Service Worker con su número de entradas (el tamaño total lo da StorageManager)
export interface CacheInfo {
  name: string;
  entries: number;
}

// ---------- Configuración global de la tienda (sin secretos) ----------
export interface PaymentConfig {
  stripe: { enabled: boolean; publishableKey?: string; statementDescriptor?: string };
  crypto: { enabled: boolean; networks: Array<{ network: "ethereum" | "polygon" | "solana" | "bitcoin"; address: string }> };
  cashOnDelivery: boolean;
  // RF-08.3 transferencia bancaria (datos que se muestran al comprador)
  bankTransfer?: { enabled: boolean; bankName: string; accountType: string; accountNumber: string; holder: string; holderId: string };
}

export interface Carrier {
  code: string;
  name: string;
  enabled: boolean;
  baseCents: number;
  perKgCents: number;
  etaDays: number;
  phone?: string; // RF-09.3 contacto del mensajero
  trackingUrl?: string; // RF-09.3 rastreo en la web de la transportadora ("{tracking}")
}

export interface ShippingConfig {
  carriers: Carrier[];
  freeShippingOverCents: number | null;
  storePickup?: { enabled: boolean; address: string }; // RF-08.2 recogida en tienda
}

// CarrierStats => RF-10.7 desempeño por transportadora (GET /shipping/stats)
export interface CarrierStats {
  carrier: string;
  shipments: number;
  delivered: number;
  onTimeRate: number;
  avgDeliveryDays: number | null;
  returned: number;
  cancelled: number;
  delayedOpen: number;
  costCents: number;
}

export interface TaxConfig {
  pricesIncludeTax: boolean;
  rates: Array<{ region: string; rate: number }>;
}

export interface CurrencyConfig {
  default: string;
  supported: string[];
}

// ReturnsConfig => RF-12.6 política de devoluciones (plazo en días y fotos obligatorias)
export interface ReturnsConfig {
  windowDays: number;
  requirePhotos: boolean;
}

export type ConfigSection = "payment" | "shipping" | "tax" | "currency" | "returns" | "help"; // "help" => RF-21.2
export interface StoreConfigEntry {
  section: ConfigSection;
  value: Record<string, unknown>;
  updatedAt: string | null;
}

// device.util.ts (Express + Prisma) => RF-08.11 huella del dispositivo y país de la IP de cada petición.
// - "X-Device-Id": SHA-256 que calcula el NAVEGADOR (Next y Nuxt) con rasgos estables (zona horaria, idioma, pantalla,
//   canvas...). El servidor solo guarda ese hash: nunca recibe los rasgos crudos (privacidad por diseño).
// - País: lo agrega el CDN/proxy delante de la API (Cloudflare "CF-IPCountry" o Nginx GeoIP2 "X-Geo-Country");
//   sin proxy (desarrollo local) queda desconocido y la regla de geolocalización simplemente no se activa.
// Paradigma funcional: funciones pequeñas sin estado; la escritura es "fire-and-forget" (nunca frena un login o pago).
import type { Request } from "express";
import { prisma } from "../../config/database.config";
import { logger } from "../middleware/logger.middleware";

export interface DeviceContext {
  deviceId?: string | undefined; // Hash SHA-256 en hexadecimal (64 caracteres)
  ipAddress?: string | undefined;
  country?: string | undefined; // ISO alpha-2 de la IP
}

const HASH = /^[a-f0-9]{64}$/; // Formato exacto: cualquier otro valor del cliente se ignora (entrada no confiable)
const COUNTRY = /^[A-Z]{2}$/;

// deviceContext => extrae y VALIDA las cabeceras (Adapter: Request de Express -> DeviceContext)
export function deviceContext(req: Request): DeviceContext {
  const deviceId = req.get("x-device-id")?.toLowerCase();
  const country = (req.get("cf-ipcountry") ?? req.get("x-geo-country"))?.toUpperCase();
  return { deviceId: deviceId && HASH.test(deviceId) ? deviceId : undefined, ipAddress: req.ip, country: country && COUNTRY.test(country) ? country : undefined };
}

// recordDevice => upsert de la huella del usuario (última IP/país y fecha); errores solo se registran en el log
export function recordDevice(userId: string, context: DeviceContext): void {
  if (!context.deviceId) return;
  const seen = { ipAddress: context.ipAddress ?? null, country: context.country ?? null, lastSeenAt: new Date() };
  prisma.deviceFingerprint
    .upsert({ where: { hash_userId: { hash: context.deviceId, userId } }, update: seen, create: { hash: context.deviceId, userId, ...seen } })
    .catch((error: unknown) => logger.warn("device_record_failed", { error }));
}

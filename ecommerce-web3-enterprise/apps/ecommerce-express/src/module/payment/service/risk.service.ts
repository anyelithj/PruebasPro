// risk.service.ts (Express + Prisma + FastAPI) => RF-08.10 / RF-08.11 evaluación de riesgo ANTES de cobrar.
// Express calcula las señales con sus datos (antigüedad de la cuenta, velocidad de compras, direcciones, huella del
// dispositivo, cuentas por dispositivo, IP nueva, país de la IP vs. país de envío, país de la tarjeta vs. envío) y el
// motor de FastAPI combina reglas + Isolation Forest + XGBoost en un puntaje 0-1 (MEDIUM/HIGH generan alerta para el
// administrador). HIGH => el cobro se detiene (422 FRAUD_REVIEW). Si el motor no responde, el pago sigue (fail-open:
// la IA ayuda, pero no tumba las ventas) y queda en el log.
// Patrones: Facade (una llamada "assess" esconde 8 consultas y la integración) + Adapter (señales -> AnalyzeRequest).
import axios from "axios";
import { prisma } from "../../../config/database.config";
import { appConfig } from "../../../config/app.config";
import { signServiceToken } from "../../auth/util/token.util";
import { recordDevice, type DeviceContext } from "../../../shared/util/device.util";
import { UnprocessableException } from "../../../shared/filter/http-exception.filter";
import { logger } from "../../../shared/middleware/logger.middleware";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const RISK_TIMEOUT_MS = 4_000; // El checkout no espera más de 4 s al motor

export interface RiskInput {
  userId: string;
  checkoutSessionId: string;
  amountCents: number;
  itemCount: number;
  shippingCountry: string | null;
  device: DeviceContext;
  cardCountry?: string | null | undefined; // País emisor de la tarjeta guardada (pago en un clic)
}

export class RiskService {
  // signals => señales de la transacción (todas las consultas en paralelo: COUNT con índices)
  public async signals(input: RiskInput): Promise<Record<string, number | boolean | string | null>> {
    const now = Date.now();
    const { deviceId, ipAddress, country } = input.device;
    const [user, ordersLast24h, addresses30d, attempts, checkoutsLastHour, deviceAccounts, knownDevices, sameIp] = await Promise.all([
      prisma.user.findUnique({ where: { id: input.userId }, select: { createdAt: true, isVerified: true } }),
      prisma.order.count({ where: { userId: input.userId, placedAt: { gte: new Date(now - DAY_MS) } } }),
      prisma.address.count({ where: { userId: input.userId, createdAt: { gte: new Date(now - 30 * DAY_MS) } } }),
      prisma.payment.count({ where: { checkoutSessionId: input.checkoutSessionId } }),
      prisma.checkoutSession.count({ where: { userId: input.userId, createdAt: { gte: new Date(now - HOUR_MS) } } }),
      // Multicuenta: usuarios DISTINTOS que operaron desde la misma huella (incluido el actual)
      deviceId ? prisma.deviceFingerprint.findMany({ where: { hash: deviceId }, select: { userId: true }, distinct: ["userId"] }) : [],
      prisma.deviceFingerprint.count({ where: { userId: input.userId } }),
      ipAddress ? prisma.deviceFingerprint.count({ where: { userId: input.userId, ipAddress } }) : 0,
    ]);
    const accountsOnDevice = new Set([...deviceAccounts.map((row) => row.userId), input.userId]).size;
    return {
      user_id: input.userId,
      amount_cents: input.amountCents,
      item_count: Math.max(1, input.itemCount),
      account_age_days: user ? Math.floor((now - user.createdAt.getTime()) / DAY_MS) : 0,
      orders_last_24h: ordersLast24h,
      distinct_addresses_30d: addresses30d,
      payment_attempts: attempts + 1,
      hour_of_day: new Date(now).getHours(),
      email_verified: user?.isVerified ?? false,
      address_mismatch: Boolean(input.cardCountry && input.shippingCountry && input.cardCountry !== input.shippingCountry),
      accounts_on_device: accountsOnDevice,
      ip_country_mismatch: Boolean(country && input.shippingCountry && country !== input.shippingCountry),
      new_ip: Boolean(ipAddress && knownDevices > 0 && sameIp === 0),
      checkouts_last_hour: checkoutsLastHour,
    };
  }

  // assess => registra la huella y bloquea solo el riesgo ALTO
  public async assess(input: RiskInput): Promise<void> {
    const features = await this.signals(input);
    recordDevice(input.userId, input.device); // Después de calcular: la huella actual no cuenta como "ya vista"
    let level: string | undefined;
    try {
      const { data } = await axios.post<{ data: { risk_level: string; risk_score: number } }>(`${appConfig.FASTAPI_URL}/api/v1/ml/fraud/analyze`, features, {
        timeout: RISK_TIMEOUT_MS,
        headers: { Authorization: `Bearer ${signServiceToken()}` },
      });
      level = data.data.risk_level;
    } catch (error) {
      logger.warn("risk_engine_unavailable", { error: error instanceof Error ? error.message : String(error) });
      return;
    }
    if (level === "HIGH") {
      logger.warn("payment_blocked_high_risk", { userId: input.userId, checkoutSessionId: input.checkoutSessionId });
      throw new UnprocessableException("No pudimos procesar este pago. Nuestro equipo lo revisará y te contactará.", "FRAUD_REVIEW");
    }
  }
}

export const riskService = new RiskService();

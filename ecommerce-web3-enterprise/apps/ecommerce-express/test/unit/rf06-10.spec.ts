// rf06-10.spec.ts (Jest) => funciones PURAS de los RF 06-10: corrección ortográfica (RF-06.1), canje de puntos
// (RF-07.3/08.7), monto cripto (RF-08.9), ventana de cancelación (RF-09.3), recomendación de transportadora (RF-10.2)
// y retraso del envío (RF-09.6). Sin base de datos ni red.
jest.mock("../../src/config/database.config", () => ({ prisma: {} }));
jest.mock("../../src/config/redis.config", () => ({ redis: {}, RedisKeys: {} }));
jest.mock("../../src/shared/interceptor/cache.interceptor", () => ({ cached: jest.fn() }));

import { correctQuery, levenshtein, tokenize } from "../../src/module/search/util/spelling.util";
import { maxRedeemablePoints } from "../../src/module/loyalty/model/loyalty.model";
import { cryptoAmount } from "../../src/module/payment/util/crypto-payment.util";
import { cancellableUntil } from "../../src/module/order/model/order.model";
import { isShipmentDelayed, quoteAll, recommendRate } from "../../src/module/shipping/model/shipping.model";

describe("RF-06.1 corrección ortográfica", () => {
  const vocabulary = new Map(tokenize("Camiseta Génesis algodón · Tenis running · Chaqueta denim").map((word) => [word, 1]));

  it("corrige palabra por palabra sin tildes y respeta las válidas", () => {
    expect(levenshtein("camisa", "camiseta")).toBe(2);
    expect(correctQuery("camiseta algodn", vocabulary)).toBe("camiseta algodon");
    expect(correctQuery("chakueta", vocabulary)).toBe("chaqueta");
  });

  it("devuelve null si todo existe o no hay candidata cercana", () => {
    expect(correctQuery("tenis running", vocabulary)).toBeNull();
    expect(correctQuery("xyzwq", vocabulary)).toBeNull();
  });
});

describe("RF-07.3 / RF-08.7 canje de puntos", () => {
  it("limita por saldo y por el porcentaje máximo del monto", () => {
    expect(maxRedeemablePoints(10_000, 10_000_000, 1_000, 50)).toBe(5_000); // $100.000 => máx 50 % = 5.000 puntos
    expect(maxRedeemablePoints(300, 10_000_000, 1_000, 50)).toBe(300);
    expect(maxRedeemablePoints(300, 0, 1_000, 50)).toBe(0);
  });
});

describe("RF-08.9 conversión a cripto", () => {
  it("redondea hacia arriba para no cobrar de menos", () => {
    expect(cryptoAmount("USDT", 41_000_00, 4_100)).toBe("10.00"); // $41.000 / 4.100 = 10 USDT
    expect(cryptoAmount("USDT", 41_001_00, 4_100)).toBe("10.01");
    expect(cryptoAmount("BTC", 400_000_000_00, 400_000_000)).toBe("1.00000000");
  });
});

describe("RF-09.3 / RF-09.6 reglas del pedido y del envío", () => {
  it("ventana de cancelación de 24 h solo en estados cancelables", () => {
    const placed = new Date("2026-10-10T10:00:00Z");
    expect(cancellableUntil("CONFIRMED", placed)?.toISOString()).toBe("2026-10-11T10:00:00.000Z");
    expect(cancellableUntil("SHIPPED", placed)).toBeNull();
  });

  it("retraso = en curso y con fecha estimada vencida", () => {
    const now = new Date("2026-10-10T00:00:00Z");
    expect(isShipmentDelayed("IN_TRANSIT", new Date("2026-10-09T00:00:00Z"), now)).toBe(true);
    expect(isShipmentDelayed("DELIVERED", new Date("2026-10-09T00:00:00Z"), now)).toBe(false);
  });
});

describe("RF-10.2 transportadora recomendada", () => {
  it("marca UNA opción (nunca la recogida) y premia el cumplimiento histórico", () => {
    const rates = quoteAll({ country: "CO", state: "Antioquia", city: "Medellín", postalCode: "050001" }, 1_500, 0);
    const marked = recommendRate(rates);
    expect(marked.filter((rate) => rate.recommended)).toHaveLength(1);
    expect(marked.find((rate) => rate.recommended)?.pickup).toBeFalsy();
    const punctual = recommendRate(rates, new Map([["DEPRISA", 1], ["SERVIENTREGA", 0.3], ["COORDINADORA", 0.3]]));
    expect(punctual.find((rate) => rate.recommended)?.code.startsWith("DEPRISA")).toBe(true);
  });
});

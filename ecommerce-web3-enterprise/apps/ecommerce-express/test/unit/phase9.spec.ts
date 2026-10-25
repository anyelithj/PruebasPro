// phase9.spec.ts (Jest) => reglas PURAS de la Fase 9 en Express: caché L1 (TTL + LRU), ventanas de analítica,
// circuit breaker, política de reintentos, autorización Pub/Sub y miembros del ZSET de reservas. Sin Redis ni bases.
jest.mock("../../src/config/redis.config", () => ({ redis: { status: "end", get: jest.fn(), set: jest.fn(), del: jest.fn() } }));

import { DashMapStore } from "../../src/module/cache/store/dashmap.store";
import { globToRegExp } from "../../src/module/cache/service/cache.service";
import { percentile, session, sliding, summarize, tumbling, type TimedPoint } from "../../src/module/realtime_analytic/util/window.util";
import { CircuitBreaker } from "../../src/module/gateway/guard/circuit_breaker.guard";
import { backoffDelay, withRetry } from "../../src/module/gateway/strategy/retry_policy.strategy";
import { canPublish, canSubscribe } from "../../src/module/websocket_gateway/util/pubsub.util";
import { expiryMember, parseExpiryMember } from "../../src/module/realtime_inventory/model/inventory.model";

describe("cache: DashMapStore (L1)", () => {
  it("desaloja la menos usada al superar el tope (LRU)", () => {
    const store = new DashMapStore<number>(2, 1_000);
    store.set("a", 1, 1_000, 0);
    store.set("b", 2, 1_000, 0);
    expect(store.get("a", 1)).toBe(1); // "a" pasa a ser la más reciente
    store.set("c", 3, 1_000, 2);
    expect(store.get("b", 3)).toBeUndefined();
    expect(store.get("a", 3)).toBe(1);
  });

  it("vence por TTL y cuenta hits/misses", () => {
    const store = new DashMapStore<string>(10, 100);
    store.set("k", "v", 100, 0);
    expect(store.get("k", 50)).toBe("v");
    expect(store.get("k", 100)).toBeUndefined();
    expect(store.stats()).toMatchObject({ hits: 1, misses: 1, size: 0 });
  });

  it("invalida por patrón glob", () => {
    const store = new DashMapStore<number>(10, 1_000);
    ["product:a", "product:b", "pricing:a"].forEach((key) => store.set(key, 1));
    expect(store.deleteMatching(globToRegExp("product:*"))).toBe(2);
    expect(globToRegExp("a.b?").test("a.bc")).toBe(true);
    expect(globToRegExp("a.b?").test("axbc")).toBe(false);
  });
});

describe("realtime_analytic: ventanas", () => {
  const points: TimedPoint[] = [0, 10, 20, 1_000, 1_010, 5_000].map((at, index) => ({ at, value: index + 1, sessionKey: at < 1_500 ? "s1" : "s2" }));

  it("sliding toma solo la última ventana", () => {
    expect(sliding(points, 100, 1_050).map((point) => point.at)).toEqual([1_000, 1_010]);
  });

  it("tumbling arma buckets alineados", () => {
    const buckets = tumbling(points, 1_000, 1_500, 2);
    expect(buckets.map((bucket) => bucket.points.length)).toEqual([3, 2]);
  });

  it("session corta por inactividad", () => {
    expect(session(points, 500).map((group) => group.points.length)).toEqual([3, 2, 1]);
  });

  it("percentiles nearest-rank", () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10);
    expect(summarize([3, 1, 2])).toMatchObject({ count: 3, sum: 6, avg: 2, p50: 2 });
  });
});

describe("gateway: circuit breaker y reintentos", () => {
  it("abre tras N fallos, rechaza al instante y prueba en HALF_OPEN", async () => {
    let now = 0;
    const breaker = new CircuitBreaker("test", { failureThreshold: 2, resetTimeoutMs: 1_000, timeoutMs: 50 }, () => now);
    const fail = () => Promise.reject(new Error("boom"));
    await expect(breaker.execute(fail)).rejects.toThrow("boom");
    await expect(breaker.execute(fail)).rejects.toThrow("boom");
    expect(breaker.snapshot().state).toBe("OPEN");
    await expect(breaker.execute(() => Promise.resolve(1))).rejects.toMatchObject({ code: "CIRCUIT_OPEN" });
    now = 1_000;
    await expect(breaker.execute(() => Promise.resolve(1))).resolves.toBe(1);
    expect(breaker.snapshot().state).toBe("CLOSED");
  });

  it("un error de negocio no abre el circuito", async () => {
    const breaker = new CircuitBreaker("test", { failureThreshold: 1, resetTimeoutMs: 1_000, timeoutMs: 50 });
    await expect(breaker.execute(() => Promise.reject(new Error("422")), () => false)).rejects.toThrow("422");
    expect(breaker.snapshot().state).toBe("CLOSED");
  });

  it("timeout cuenta como fallo", async () => {
    const breaker = new CircuitBreaker("lento", { failureThreshold: 1, resetTimeoutMs: 1_000, timeoutMs: 10 });
    await expect(breaker.execute(() => new Promise((resolve) => setTimeout(resolve, 100)))).rejects.toMatchObject({ code: "GATEWAY_TIMEOUT" });
    expect(breaker.snapshot().state).toBe("OPEN");
  });

  it("reintenta solo errores transitorios con backoff acotado", async () => {
    const policy = { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 250 };
    expect(backoffDelay(3, policy, () => 1)).toBe(250);
    let calls = 0;
    const result = await withRetry(async () => (++calls < 3 ? Promise.reject(new Error("red")) : "ok"), () => true, policy, async () => undefined);
    expect(result).toEqual({ value: "ok", attempts: 3 });
    await expect(withRetry(() => Promise.reject(new Error("negocio")), () => false, policy, async () => undefined)).rejects.toThrow("negocio");
  });
});

describe("websocket_gateway: autorización por tópico", () => {
  const customer = { id: "u1", roles: ["CUSTOMER"] };
  const admin = { id: "a1", roles: ["ADMIN"] };

  it("público para todos, user:<id> solo el dueño, admin:* solo ADMIN", () => {
    expect(canSubscribe("public:news", customer)).toBe(true);
    expect(canSubscribe("user:u1", customer)).toBe(true);
    expect(canSubscribe("user:u2", customer)).toBe(false);
    expect(canSubscribe("admin:ops", customer)).toBe(false);
    expect(canSubscribe("admin:ops", admin)).toBe(true);
    expect(canPublish("user:u1", customer)).toBe(false);
  });
});

describe("realtime_inventory: miembro del ZSET de reservas", () => {
  it("ida y vuelta, y rechaza miembros corruptos", () => {
    const member = expiryMember({ id: "r1", productId: "v1", quantity: 2 });
    expect(parseExpiryMember(member)).toEqual({ id: "r1", productId: "v1", quantity: 2 });
    expect(parseExpiryMember("r1:v1:0")).toBeNull();
    expect(parseExpiryMember("basura")).toBeNull();
  });
});

// phase8.spec.ts (Jest) => reglas PURAS del módulo CMS (Fase 8): validación de "data" por tipo, schemas de
// configuración (sin secretos) y la vista pública de la configuración. Sin MongoDB ni Redis.
jest.mock("../../src/module/webhook/handler/webhook.handler", () => ({ webhookDispatcher: { dispatch: jest.fn(async () => undefined) } }));
jest.mock("../../src/config/redis.config", () => ({ redis: { get: jest.fn(), set: jest.fn(), del: jest.fn(), scan: jest.fn() } }));

import { parseData, publicConfig, sanitizeHtml } from "../../src/module/cms/service/cms.service";
import { CONFIG_SCHEMAS, ContentSchema, LeadSchema } from "../../src/module/cms/schema/cms.schema";
import * as crypto from "node:crypto";
import { encrypt, parseSubscription, vapidAuthorization } from "../../src/shared/util/web-push.util";

describe("cms: data por tipo", () => {
  it("evento exige fin posterior al inicio", () => {
    expect(() => parseData("event", { startsAt: "2026-11-02", endsAt: "2026-11-01" })).toThrow();
    expect(parseData("event", { startsAt: "2026-11-01", endsAt: "2026-11-02" })).toMatchObject({ location: "Online", online: true });
  });

  it("landing normaliza el cupón y acepta testimonios", () => {
    expect(parseData("landing", { couponCode: "promo10", testimonials: [{ author: "Ana", quote: "Excelente" }] })).toMatchObject({ couponCode: "PROMO10" });
  });
});

describe("cms: contenido y leads", () => {
  it("slug en kebab-case y texto alternativo obligatorio", () => {
    expect(ContentSchema.safeParse({ slug: "Black Friday", title: "Black Friday" }).success).toBe(false);
    expect(ContentSchema.safeParse({ slug: "black-friday", title: "Black Friday", media: [{ url: "https://res.cloudinary.com/x.jpg", alt: "" }] }).success).toBe(false);
    expect(ContentSchema.parse({ slug: "black-friday", title: "Black Friday" }).status).toBe("DRAFT");
  });

  it("lead sin consentimiento se rechaza", () => {
    expect(LeadSchema.safeParse({ email: "ana@test.co", consent: false }).success).toBe(false);
    expect(LeadSchema.parse({ email: "ANA@test.co", consent: true }).email).toBe("ana@test.co");
  });
});

describe("cms: configuración de tienda", () => {
  it("solo acepta la llave PÚBLICA de Stripe", () => {
    const payment = { stripe: { enabled: true, publishableKey: "sk_live_secreta" }, crypto: { enabled: false } };
    expect(CONFIG_SCHEMAS.payment.safeParse(payment).success).toBe(false);
  });

  it("la vista pública oculta las billeteras", () => {
    const view = publicConfig([
      { section: "payment", value: { stripe: { enabled: true, publishableKey: "pk_test_1" }, crypto: { enabled: true, networks: [{ network: "polygon", address: "0xabc" }] } }, updatedAt: null },
    ]);
    // RF-08.3/08.9: se publican los medios y las REDES disponibles, nunca la dirección de la billetera
    expect(view["payment"]).toEqual({ stripe: { enabled: true, publishableKey: "pk_test_1" }, crypto: { enabled: true, networks: ["polygon"] }, cashOnDelivery: false, bankTransfer: { enabled: false } });
    expect(JSON.stringify(view)).not.toContain("0xabc");
    expect(view["shipping"]).toBeNull();
  });
});

describe("cms: saneo del HTML de GrapesJS", () => {
  it("quita scripts, iframes, eventos on* y javascript:", () => {
    const dirty = `<section onclick="robar()"><script>alert(1)</script><iframe src="https://x"></iframe><a href="javascript:alert(1)">x</a><img src="a.jpg" onerror='x()' alt="a"></section>`;
    const clean = sanitizeHtml(dirty);
    expect(clean).not.toMatch(/script|iframe|onclick|onerror|javascript:/i);
    expect(clean).toContain('<img src="a.jpg" alt="a">');
  });
});

describe("web push (RFC 8291 + VAPID)", () => {
  const hmac = (key: Buffer, data: Buffer) => crypto.createHmac("sha256", key).update(data).digest();

  it("el navegador descifra lo que cifra el servidor", () => {
    const browser = crypto.createECDH("prime256v1");
    browser.generateKeys();
    const auth = crypto.randomBytes(16);
    const subscription = { endpoint: "https://push.example.com/abc", keys: { p256dh: browser.getPublicKey().toString("base64url"), auth: auth.toString("base64url") } };
    const body = encrypt(Buffer.from('{"title":"Hola"}'), subscription);
    // Lado del navegador (RFC 8291): misma derivación con su llave privada
    const salt = body.subarray(0, 16);
    const serverPublic = body.subarray(21, 21 + body[20]!);
    const ikm = hmac(hmac(auth, browser.computeSecret(serverPublic)), Buffer.concat([Buffer.from("WebPush: info\0"), browser.getPublicKey(), serverPublic, Buffer.from([1])]));
    const prk = hmac(salt, ikm);
    const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01")).subarray(0, 16);
    const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0\x01")).subarray(0, 12);
    const encrypted = body.subarray(21 + body[20]!);
    const decipher = crypto.createDecipheriv("aes-128-gcm", cek, nonce);
    decipher.setAuthTag(encrypted.subarray(encrypted.length - 16));
    const plain = Buffer.concat([decipher.update(encrypted.subarray(0, encrypted.length - 16)), decipher.final()]);
    expect(plain.subarray(0, -1).toString()).toBe('{"title":"Hola"}');
    expect(plain.at(-1)).toBe(2);
  });

  it("la firma VAPID se verifica con la llave pública", () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
    const jwk = privateKey.export({ format: "jwk" });
    const raw = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x as string, "base64url"), Buffer.from(jwk.y as string, "base64url")]);
    const header = vapidAuthorization("https://push.example.com/abc", { publicKey: raw.toString("base64url"), privateKey: jwk.d as string, subject: "mailto:a@b.co" });
    const token = /t=([^,]+)/.exec(header)?.[1] ?? "";
    const [h, p, s] = token.split(".");
    expect(JSON.parse(Buffer.from(p!, "base64url").toString()).aud).toBe("https://push.example.com");
    expect(crypto.verify("sha256", Buffer.from(`${h}.${p}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s!, "base64url"))).toBe(true);
  });

  it("distingue suscripciones Web Push de tokens FCM", () => {
    expect(parseSubscription("fcm-token-123456789012345")).toBeNull();
    expect(parseSubscription('{"endpoint":"https://x.y/z","keys":{"p256dh":"a","auth":"b"}}')?.endpoint).toBe("https://x.y/z");
  });
});

// web-push.util.ts (Node.js crypto nativo) => envío de notificaciones Web Push estándar a la PWA de Nuxt (Fase 8)
// SIN librerías: cifrado del mensaje "aes128gcm" (RFC 8291) y autenticación VAPID con JWT ES256 (RFC 8292).
// Complementa a FCM (que necesita el SDK de Firebase en el navegador): cualquier navegador con PushManager funciona.
// Patrón Adapter (suscripción del navegador -> petición HTTP al servicio push) + funciones puras testeables.
import { createECDH, createHmac, createCipheriv, createPrivateKey, randomBytes, sign, type ECDH } from "node:crypto";

// PushSubscription => lo que entrega PushManager.subscribe() en el navegador (serializado con JSON.stringify)
export interface WebPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface VapidKeys {
  publicKey: string; // base64url, punto P-256 sin comprimir (65 bytes)
  privateKey: string; // base64url, escalar de 32 bytes
  subject: string; // "mailto:soporte@tienda.co" o URL del sitio
}

const b64url = (buffer: Buffer) => buffer.toString("base64url");
const fromB64url = (value: string) => Buffer.from(value, "base64url");
// hmac => HKDF de un paso (extract/expand con HMAC-SHA-256) tal como lo define RFC 8291
const hmac = (key: Buffer, data: Buffer) => createHmac("sha256", key).update(data).digest();

// parseSubscription => token guardado -> suscripción válida (null si es un token FCM u otro formato)
export function parseSubscription(token: string): WebPushSubscription | null {
  if (!token.startsWith("{")) return null;
  try {
    const value = JSON.parse(token) as Partial<WebPushSubscription>;
    return value.endpoint?.startsWith("https://") && value.keys?.p256dh && value.keys.auth ? (value as WebPushSubscription) : null;
  } catch {
    return null;
  }
}

// encrypt => cuerpo aes128gcm: salt(16) | rs(4) | idlen(1) | clave pública efímera(65) | texto cifrado + tag
// "ecdh" opcional => las pruebas inyectan una llave fija; en producción se genera una efímera por mensaje
export function encrypt(payload: Buffer, subscription: WebPushSubscription, salt = randomBytes(16), ecdh?: ECDH): Buffer {
  const server = ecdh ?? createECDH("prime256v1");
  if (!ecdh) server.generateKeys();
  const uaPublic = fromB64url(subscription.keys.p256dh);
  const authSecret = fromB64url(subscription.keys.auth);
  const asPublic = server.getPublicKey(); // 65 bytes sin comprimir
  const sharedSecret = server.computeSecret(uaPublic);
  // IKM = HKDF(auth, ecdh, "WebPush: info" || 0 || ua_public || as_public)
  const prkKey = hmac(authSecret, sharedSecret);
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.concat([Buffer.from("Content-Encoding: aes128gcm\0"), Buffer.from([1])])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.concat([Buffer.from("Content-Encoding: nonce\0"), Buffer.from([1])])).subarray(0, 12);
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  // 0x02 => delimitador del ÚLTIMO (y único) registro
  const encrypted = Buffer.concat([cipher.update(Buffer.concat([payload, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16); // Tamaño de registro
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, encrypted]);
}

// vapidAuthorization => "vapid t=<JWT ES256>, k=<llave pública>" para el origen del endpoint (válido 12 h)
export function vapidAuthorization(endpoint: string, keys: VapidKeys, now = Date.now()): string {
  const publicKey = fromB64url(keys.publicKey);
  const privateKey = createPrivateKey({
    key: { kty: "EC", crv: "P-256", d: keys.privateKey, x: b64url(publicKey.subarray(1, 33)), y: b64url(publicKey.subarray(33, 65)) },
    format: "jwk",
  });
  const encode = (value: object) => b64url(Buffer.from(JSON.stringify(value)));
  const unsigned = `${encode({ typ: "JWT", alg: "ES256" })}.${encode({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: keys.subject })}`;
  // "ieee-p1363" => firma r||s de 64 bytes (formato JOSE), no DER
  const signature = sign("sha256", Buffer.from(unsigned), { key: privateKey, dsaEncoding: "ieee-p1363" });
  return `vapid t=${unsigned}.${b64url(signature)}, k=${keys.publicKey}`;
}

// sendWebPush => envía un mensaje; devuelve el status HTTP (404/410 => suscripción vencida, hay que borrarla)
export async function sendWebPush(subscription: WebPushSubscription, payload: Record<string, unknown>, keys: VapidKeys): Promise<number> {
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: { "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "86400", Urgency: "normal", Authorization: vapidAuthorization(subscription.endpoint, keys) },
    body: encrypt(Buffer.from(JSON.stringify(payload)), subscription),
    signal: AbortSignal.timeout(5000),
  });
  return response.status;
}

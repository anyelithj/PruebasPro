// idempotency.middleware.ts (Express + Redis) => RF-28.7 reintentos sin duplicados: si una petición que modifica datos
// (POST/PUT/PATCH/DELETE) trae la cabecera "Idempotency-Key", su respuesta se guarda 24 h. Un reintento con la misma
// clave (la PWA lo reenvía al volver la conexión) recibe la MISMA respuesta sin volver a ejecutar la acción:
// un pedido, un pago o un "agregar al carrito" nunca se duplican.
//   1ª vez  => SET NX "PENDING" (reserva atómica) -> se ejecuta -> se guarda { status, body }
//   en curso => 409 IDEMPOTENCY_IN_PROGRESS (la primera aún no termina)
//   repetida => se responde lo guardado + cabecera "Idempotent-Replayed: true"
// Errores 5xx no se guardan (se libera la clave: el reintento debe poder ejecutarse). Sin Redis => pasa de largo.
// Patrones: Chain of Responsibility (middleware) + Proxy (intercepta res.json) + Memento (respuesta guardada).
import type { NextFunction, Request, Response } from "express";
import { redis } from "../../config/redis.config";

const TTL_SECONDS = 24 * 60 * 60;
const KEY = /^[\w-]{8,100}$/; // UUID o similar: cualquier otro valor se ignora (entrada no confiable)
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// idempotencyKey => clave Redis por usuario (sub del JWT) + método + ruta: la misma clave en otra ruta no choca (pura)
export const idempotencyKey = (owner: string, method: string, path: string, key: string) => `idem:${owner}:${method}:${path}:${key}`;

// ownerOf => "sub" del JWT (sin verificar: solo separa espacios de claves; la autenticación real la hace el guard de
// cada ruta). No se usa la IP: en móvil cambia al recuperar la red y el reintento no encontraría su respuesta
export function ownerOf(authorization: string | undefined): string {
  const payload = authorization?.startsWith("Bearer ") ? authorization.slice(7).split(".")[1] : undefined;
  if (!payload) return "anon";
  try {
    return String((JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: string }).sub ?? "anon");
  } catch {
    return "anon";
  }
}

export async function idempotency(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.get("idempotency-key");
  if (!MUTATING.has(req.method) || !header || !KEY.test(header)) return next();
  const owner = ownerOf(req.get("authorization"));
  const key = idempotencyKey(owner, req.method, req.baseUrl + req.path, header);
  try {
    const reserved = await redis.set(key, "PENDING", "EX", TTL_SECONDS, "NX");
    if (reserved !== "OK") {
      const stored = await redis.get(key);
      if (stored === "PENDING") {
        res.status(409).json({ success: false, code: "IDEMPOTENCY_IN_PROGRESS", message: "La solicitud original aún se está procesando" });
        return;
      }
      const { status, body } = JSON.parse(stored ?? "{}") as { status: number; body: unknown };
      res.setHeader("Idempotent-Replayed", "true").status(status).json(body);
      return;
    }
  } catch {
    return next(); // Redis caído: degradación parcial (se atiende normal, sin protección de duplicados)
  }
  // Proxy de res.json: guarda la respuesta final antes de enviarla
  const original = res.json.bind(res);
  res.json = (body: unknown) => {
    const save = res.statusCode >= 500 ? redis.del(key) : redis.set(key, JSON.stringify({ status: res.statusCode, body }), "EX", TTL_SECONDS);
    void save.catch(() => undefined);
    return original(body);
  };
  // Respuestas sin cuerpo JSON (204) o conexiones cortadas: se libera o se marca para no quedar "PENDING" para siempre
  res.on("finish", () => {
    if (res.statusCode === 204) void redis.set(key, JSON.stringify({ status: 204, body: null }), "EX", TTL_SECONDS).catch(() => undefined);
  });
  res.on("close", () => {
    if (!res.writableFinished) void redis.del(key).catch(() => undefined);
  });
  next();
}

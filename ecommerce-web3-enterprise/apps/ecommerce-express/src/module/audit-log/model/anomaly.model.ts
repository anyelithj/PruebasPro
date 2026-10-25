// anomaly.model.ts (TypeScript puro) => RF-30.4 detección de anomalías en el audit trail, sin base de datos (testeable).
// Reglas sobre una ventana reciente de registros:
//   BRUTE_FORCE      => muchas respuestas 401/403 desde la misma IP (posible fuerza bruta o escaneo)
//   MASS_DELETE      => un mismo usuario borra muchos recursos en poco tiempo
//   OFF_HOURS_ADMIN  => acciones de administrador en la madrugada (hora local Colombia, UTC-5)
//   NEW_IP_ADMIN     => un administrador actúa desde una IP que no usó en los últimos 30 días
// Paradigma: funcional (función pura). Patrón Strategy (una regla por tipo, en tabla).

export interface AuditEntryLite {
  actorId: string | null;
  actorRoles: string[];
  action: string;
  status: number | null;
  ip: string | null;
  createdAt: Date;
}

export type AnomalyType = "BRUTE_FORCE" | "MASS_DELETE" | "OFF_HOURS_ADMIN" | "NEW_IP_ADMIN";
export interface Anomaly {
  type: AnomalyType;
  key: string; // IP o actor afectado (deduplicación de alertas)
  count: number;
  detail: string;
}

export const THRESHOLDS = { bruteForce: 10, massDelete: 20, offHoursFrom: 0, offHoursTo: 5, offHoursMin: 5 } as const;
const BOGOTA_OFFSET_HOURS = -5;

// groupCount => cuenta por clave (función auxiliar pura)
function groupCount<T>(items: T[], key: (item: T) => string | null): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

// detectAnomalies => entradas recientes + IPs conocidas por admin (últimos 30 días, sin la ventana actual)
export function detectAnomalies(entries: AuditEntryLite[], knownAdminIps: Map<string, Set<string>>): Anomaly[] {
  const anomalies: Anomaly[] = [];
  for (const [ip, count] of groupCount(entries.filter((e) => e.status === 401 || e.status === 403), (e) => e.ip)) {
    if (count >= THRESHOLDS.bruteForce) anomalies.push({ type: "BRUTE_FORCE", key: ip, count, detail: `${count} accesos denegados desde ${ip}` });
  }
  for (const [actor, count] of groupCount(entries.filter((e) => e.action.startsWith("DELETE ") && (e.status ?? 200) < 400), (e) => e.actorId)) {
    if (count >= THRESHOLDS.massDelete) anomalies.push({ type: "MASS_DELETE", key: actor, count, detail: `${count} eliminaciones del usuario ${actor}` });
  }
  const admin = entries.filter((e) => e.actorRoles.includes("ADMIN") && e.actorId);
  const offHours = admin.filter((e) => {
    const hour = (e.createdAt.getUTCHours() + 24 + BOGOTA_OFFSET_HOURS) % 24;
    return hour >= THRESHOLDS.offHoursFrom && hour < THRESHOLDS.offHoursTo;
  });
  for (const [actor, count] of groupCount(offHours, (e) => e.actorId)) {
    if (count >= THRESHOLDS.offHoursMin) anomalies.push({ type: "OFF_HOURS_ADMIN", key: actor, count, detail: `${count} acciones de administrador en la madrugada (${actor})` });
  }
  const seen = new Set<string>();
  for (const entry of admin) {
    const key = `${entry.actorId}|${entry.ip}`;
    if (!entry.ip || seen.has(key)) continue;
    seen.add(key);
    const known = knownAdminIps.get(entry.actorId!);
    if (known && known.size > 0 && !known.has(entry.ip)) anomalies.push({ type: "NEW_IP_ADMIN", key: key, count: 1, detail: `Administrador ${entry.actorId} desde una IP nueva (${entry.ip})` });
  }
  return anomalies;
}

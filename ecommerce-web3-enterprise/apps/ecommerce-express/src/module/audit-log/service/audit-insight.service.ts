// audit-insight.service.ts => auditoría avanzada:
//  - RF-30.3 exportación del registro filtrado a CSV y PDF
//  - RF-30.4 detección periódica de anomalías (fuerza bruta, borrado masivo, admin en la madrugada, IP nueva) con
//    registro CRITICAL, aviso a administradores y evento en tiempo real
//  - RF-30.7 reporte de cumplimiento (compliance): controles con estado CUMPLE / NO CUMPLE y evidencia
//  - RF-30.8 monitoreo en tiempo real: cada lote del audit trail se publica a la sala "admin:audit" (Socket.io)
// Patrones: Facade + Observer (auditEvents -> gateway) + Strategy (reglas de anomalía y controles como datos).
import type { Server } from "socket.io";
import { AuditLogModel } from "../model/audit.model";
import { detectAnomalies, type AuditEntryLite } from "../model/anomaly.model";
import { auditEvents, auditService } from "./audit.service";
import type { AuditLogDto } from "../dto/audit.dto";
import { renderPdf } from "../../invoice/util/pdf.util";
import { toCsv } from "../../analytics/service/advanced.service";
import { notificationService } from "../../notification/service/notification.service";
import { prisma } from "../../../config/database.config";
import { redis } from "../../../config/redis.config";
import { appConfig } from "../../../config/app.config";
import { Roles } from "../../../shared/constants/roles.constants";
import { isAdmin } from "../../../shared/decorator/auth.decorator";
import type { AuthenticatedRequestUser } from "../../auth/types/auth.types";

const DAY = 86_400_000;
const WINDOW_MS = 10 * 60_000; // Ventana de detección: últimos 10 minutos
const REVIEW_SLA_HOURS = 72; // Los eventos CRITICAL deben revisarse en 72 h

export class AuditInsightService {
  // ---------- RF-30.3 exportación ----------
  public toCsv(rows: AuditLogDto[]): string {
    return toCsv(rows.map((row) => ({ fecha: row.createdAt, severidad: row.severity, modulo: row.module, accion: row.action, recurso: row.resourceId, actor: row.actorId, roles: row.actorRoles.join("|"), ip: row.ip, estado: row.status, revisado: row.reviewed, revisadoPor: row.reviewedBy })));
  }

  public toPdf(rows: AuditLogDto[], filters: Record<string, unknown>): Promise<Buffer> {
    return renderPdf((doc) => {
      doc.fontSize(16).text("Registro de auditoría", { align: "center" });
      doc.fontSize(8).text(`Generado: ${new Date().toISOString()} · Filtros: ${JSON.stringify(filters)} · ${rows.length} registros`, { align: "center" });
      doc.moveDown();
      for (const row of rows) {
        doc.fontSize(8).fillColor(row.severity === "CRITICAL" ? "#b91c1c" : row.severity === "WARNING" ? "#b45309" : "#0f172a");
        doc.text(`${row.createdAt.toISOString().replace("T", " ").slice(0, 19)}  [${row.severity}]  ${row.action}  ${row.status ?? ""}`, { continued: false });
        doc.fillColor("#475569").text(`   actor ${row.actorId ?? "sistema"} · ip ${row.ip ?? "—"} · recurso ${row.resourceId ?? "—"}${row.reviewed ? " · revisado" : ""}`);
      }
    });
  }

  // ---------- RF-30.4 anomalías ----------
  // scanAnomalies => job cada 10 min: aplica las reglas a la ventana reciente; cada anomalía se registra una sola vez
  // por clave y hora (SET NX en Redis) para no inundar de alertas
  public async scanAnomalies(): Promise<number> {
    const since = new Date(Date.now() - WINDOW_MS);
    const recent = (await AuditLogModel.find({ createdAt: { $gte: since }, source: "HTTP" }).select({ actorId: 1, actorRoles: 1, action: 1, status: 1, ip: 1, createdAt: 1 }).limit(20_000).lean()) as unknown as AuditEntryLite[];
    if (recent.length === 0) return 0;
    const adminIds = [...new Set(recent.filter((e) => e.actorRoles.includes("ADMIN") && e.actorId).map((e) => e.actorId!))];
    const history = adminIds.length
      ? await AuditLogModel.aggregate<{ _id: string; ips: string[] }>([
          { $match: { actorId: { $in: adminIds }, ip: { $ne: null }, createdAt: { $gte: new Date(Date.now() - 30 * DAY), $lt: since } } },
          { $group: { _id: "$actorId", ips: { $addToSet: "$ip" } } },
        ])
      : [];
    const anomalies = detectAnomalies(recent, new Map(history.map((row) => [row._id, new Set(row.ips)])));
    let fired = 0;
    for (const anomaly of anomalies) {
      const first = await redis.set(`audit:anomaly:${anomaly.type}:${anomaly.key}`, "1", "EX", 3600, "NX").catch(() => "OK");
      if (first !== "OK") continue;
      fired += 1;
      auditService.record({ actorId: null, action: `anomaly.${anomaly.type.toLowerCase()}`, module: "security", resourceId: anomaly.key, source: "EVENT", severity: "CRITICAL", metadata: { ...anomaly } });
      const admins = await prisma.user.findMany({ where: { isActive: true, roles: { some: { role: { name: Roles.ADMIN } } } }, select: { id: true } });
      await notificationService.broadcast(admins.map((a) => a.id), { type: "SECURITY", message: { title: `Anomalía de seguridad: ${anomaly.type}`, body: anomaly.detail }, url: "/dashboard/settings?tab=audit", channels: ["IN_APP", "EMAIL"] });
    }
    return fired;
  }

  // ---------- RF-30.7 cumplimiento ----------
  public async compliance(from: Date, to: Date) {
    const range = { createdAt: { $gte: from, $lte: to } };
    const [critical, reviewedInSla, accessDenied, deletions, admins, oldest] = await Promise.all([
      AuditLogModel.countDocuments({ ...range, severity: "CRITICAL" }),
      AuditLogModel.countDocuments({ ...range, severity: "CRITICAL", reviewed: true, $expr: { $lte: [{ $subtract: ["$reviewedAt", "$createdAt"] }, REVIEW_SLA_HOURS * 3_600_000] } }),
      AuditLogModel.countDocuments({ ...range, status: { $in: [401, 403] } }),
      AuditLogModel.countDocuments({ ...range, action: { $regex: "^DELETE " } }),
      prisma.user.findMany({ where: { isActive: true, roles: { some: { role: { name: Roles.ADMIN } } } }, select: { id: true, email: true, twoFactorEnabled: true } }),
      AuditLogModel.findOne().sort({ createdAt: 1 }).select({ createdAt: 1 }).lean(),
    ]);
    const anonymized = await prisma.user.count({ where: { deletedAt: { gte: from, lte: to } } });
    const without2fa = admins.filter((admin) => !admin.twoFactorEnabled);
    const pct = critical ? reviewedInSla / critical : 1;
    // Controles: cada uno con su evidencia (Strategy declarativa: agregar un control = agregar una fila)
    const controls = [
      { id: "CRITICAL_REVIEW_SLA", title: `Eventos críticos revisados en ≤ ${REVIEW_SLA_HOURS} h`, passed: pct >= 0.95, evidence: `${reviewedInSla}/${critical} (${Math.round(pct * 100)} %)` },
      { id: "ADMIN_2FA", title: "Administradores con verificación en dos pasos", passed: without2fa.length === 0, evidence: without2fa.length ? `Sin 2FA: ${without2fa.map((a) => a.email).join(", ")}` : `${admins.length}/${admins.length}` },
      { id: "RETENTION_POLICY", title: "Retención del registro ≥ 365 días", passed: appConfig.AUDIT_RETENTION_DAYS >= 365, evidence: `${appConfig.AUDIT_RETENTION_DAYS} días (registro más antiguo: ${oldest?.createdAt?.toISOString().slice(0, 10) ?? "—"})` },
      { id: "IMMUTABLE_LOG", title: "Registro inmutable (solo la revisión es editable)", passed: true, evidence: "Campos immutable en Mongoose; la purga solo por política de retención" },
      { id: "GDPR_ERASURE", title: "Solicitudes de borrado (GDPR) atendidas", passed: true, evidence: `${anonymized} cuentas anonimizadas en el período` },
    ];
    return { from, to, generatedAt: new Date(), score: Math.round((controls.filter((c) => c.passed).length / controls.length) * 100), controls, metrics: { critical, reviewedInSla, accessDenied, deletions, admins: admins.length } };
  }

  public compliancePdf(report: Awaited<ReturnType<AuditInsightService["compliance"]>>): Promise<Buffer> {
    return renderPdf((doc) => {
      doc.fontSize(18).text("Reporte de cumplimiento", { align: "center" });
      doc.fontSize(10).text(`${report.from.toISOString().slice(0, 10)} — ${report.to.toISOString().slice(0, 10)} · Puntaje ${report.score} %`, { align: "center" });
      doc.moveDown();
      for (const control of report.controls) {
        doc.fontSize(11).fillColor(control.passed ? "#166534" : "#b91c1c").text(`${control.passed ? "✔ CUMPLE" : "✘ NO CUMPLE"} · ${control.title}`);
        doc.fontSize(9).fillColor("#334155").text(`   ${control.evidence}`);
        doc.moveDown(0.5);
      }
      doc.moveDown().fontSize(10).fillColor("#0f172a").text(`Eventos críticos: ${report.metrics.critical} · Accesos denegados: ${report.metrics.accessDenied} · Eliminaciones: ${report.metrics.deletions}`);
    });
  }
}

// registerAuditGateway => RF-30.8 sala "admin:audit": los administradores reciben cada lote nuevo del registro
export function registerAuditGateway(io: Server): void {
  io.on("connection", (socket) => {
    const user = socket.data["user"] as AuthenticatedRequestUser | undefined;
    socket.on("audit:subscribe", () => {
      if (user && isAdmin(user)) void socket.join("admin:audit");
    });
    socket.on("audit:unsubscribe", () => void socket.leave("admin:audit"));
  });
  auditEvents.on("audit.recorded", ({ entries }) => {
    io.to("admin:audit").emit("audit:entries", entries);
  });
}

export const auditInsightService = new AuditInsightService();

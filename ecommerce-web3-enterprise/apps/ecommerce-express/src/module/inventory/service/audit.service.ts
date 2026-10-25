// audit.service.ts => RF-23.7 auditoría de inventario por escaneo de QR:
//  1) Etiquetas: QR en SVG por variante con el contenido "SKU:<sku>" (uqr: generador sin dependencias)
//  2) Sesión de conteo por bodega: cada escaneo suma una unidad (o fija la cantidad contada)
//  3) Cierre: diferencias contra el sistema y, si se aprueba, ajuste del stock (movimiento ADJUSTMENT auditable)
// Patrones: Facade + State (OPEN -> CLOSED) + Command (cada escaneo). MongoDB: sesiones de documentos flexibles.
// Paradigma: POO + funcional (parseCode y discrepancies son funciones puras).
import { Schema, model } from "mongoose";
import { renderSVG } from "uqr";
import { prisma } from "../../../config/database.config";
import { NotFoundException, UnprocessableException } from "../../../shared/filter/http-exception.filter";
import { inventoryService } from "./inventory.service";
import { Warehouses, type Warehouse } from "../model/inventory.model";

const auditSchema = new Schema(
  {
    warehouse: { type: String, enum: Warehouses, default: "MAIN" },
    note: { type: String, default: null, maxlength: 300 },
    status: { type: String, enum: ["OPEN", "CLOSED"], default: "OPEN" },
    createdBy: { type: String, required: true },
    closedAt: { type: Date, default: null },
    applied: { type: Boolean, default: false }, // true => las diferencias se ajustaron en el stock
    // Conteos por variante (SKU de referencia para mostrar sin consultar PostgreSQL)
    counts: { type: [new Schema({ variantId: String, sku: String, counted: Number, scannedAt: Date }, { _id: false })], default: [] },
  },
  { timestamps: true, versionKey: false }
);
auditSchema.index({ status: 1, createdAt: -1 });
export const InventoryAuditModel = model("InventoryAudit", auditSchema);

// parseCode => acepta el contenido del QR ("SKU:ABC-1") o el SKU escrito a mano (función PURA)
export const parseCode = (code: string) => code.trim().replace(/^SKU:/i, "").toUpperCase();

// discrepancies => diferencia contado - sistema por variante (solo las que no cuadran)
export const discrepancies = (counts: Array<{ variantId: string; sku: string; counted: number }>, stock: Map<string, number>) =>
  counts.map((c) => ({ ...c, system: stock.get(c.variantId) ?? 0, difference: c.counted - (stock.get(c.variantId) ?? 0) })).filter((row) => row.difference !== 0);

type AuditDoc = { _id: unknown; status: string; warehouse: string; note: string | null; createdBy: string; closedAt: Date | null; applied: boolean; counts: Array<{ variantId?: string | null; sku?: string | null; counted?: number | null }>; createdAt?: Date };
const toDto = (doc: AuditDoc) => ({
  id: String(doc._id),
  status: doc.status,
  warehouse: doc.warehouse,
  note: doc.note,
  applied: doc.applied,
  closedAt: doc.closedAt,
  createdAt: doc.createdAt ?? new Date(),
  counts: doc.counts.map((c) => ({ variantId: c.variantId ?? "", sku: c.sku ?? "", counted: c.counted ?? 0 })),
});

export class InventoryAuditService {
  // labels => QR de hasta 100 variantes para imprimir (SVG escalable: nítido en cualquier impresora)
  public async labels(variantIds: string[]) {
    const variants = await prisma.productVariant.findMany({ where: { id: { in: variantIds } }, select: { id: true, sku: true, name: true, product: { select: { name: true } } } });
    return variants.map((variant) => ({ variantId: variant.id, sku: variant.sku, name: `${variant.product.name} ${variant.name}`.trim(), svg: renderSVG(`SKU:${variant.sku}`, { border: 1 }) }));
  }

  public async start(warehouse: Warehouse, note: string | null, userId: string) {
    return toDto((await InventoryAuditModel.create({ warehouse, note, createdBy: userId })).toObject() as AuditDoc);
  }

  public async list() {
    return (await InventoryAuditModel.find().sort({ createdAt: -1 }).limit(50).lean()).map((doc) => toDto(doc as AuditDoc));
  }

  public async get(id: string) {
    const doc = await InventoryAuditModel.findById(id).lean();
    if (!doc) throw new NotFoundException("InventoryAudit", id);
    return toDto(doc as AuditDoc);
  }

  // scan => suma 1 (o fija "counted") a la variante del código; sesión cerrada => 422
  public async scan(id: string, code: string, counted?: number) {
    const audit = await this.get(id);
    if (audit.status !== "OPEN") throw new UnprocessableException("La auditoría ya está cerrada", "AUDIT_CLOSED");
    const sku = parseCode(code);
    const variant = await prisma.productVariant.findFirst({ where: { sku: { equals: sku, mode: "insensitive" } }, select: { id: true, sku: true } });
    if (!variant) throw new NotFoundException("ProductVariant", sku);
    const existing = audit.counts.find((c) => c.variantId === variant.id);
    const next = counted ?? (existing?.counted ?? 0) + 1;
    // Actualización atómica: posicional si ya existe, $push si es la primera vez
    const updated = existing
      ? await InventoryAuditModel.findOneAndUpdate({ _id: id, "counts.variantId": variant.id }, { $set: { "counts.$.counted": next, "counts.$.scannedAt": new Date() } }, { new: true }).lean()
      : await InventoryAuditModel.findByIdAndUpdate(id, { $push: { counts: { variantId: variant.id, sku: variant.sku, counted: next, scannedAt: new Date() } } }, { new: true }).lean();
    return { sku: variant.sku, counted: next, audit: toDto(updated as AuditDoc) };
  }

  // close => diferencias contra el stock actual; "apply" ajusta cada variante al conteo (quién y cuándo queda en el
  // historial de movimientos: RF-23.10)
  public async close(id: string, apply: boolean, actorId: string) {
    const audit = await this.get(id);
    if (audit.status !== "OPEN") throw new UnprocessableException("La auditoría ya está cerrada", "AUDIT_CLOSED");
    const levels = await prisma.productVariant.findMany({ where: { id: { in: audit.counts.map((c) => c.variantId) } }, select: { id: true, stock: true } });
    const diff = discrepancies(audit.counts, new Map(levels.map((level) => [level.id, level.stock])));
    if (apply) for (const row of diff) await inventoryService.updateInventory(row.variantId, { stock: row.counted, reason: `Auditoría QR ${id}` }, actorId);
    await InventoryAuditModel.updateOne({ _id: id }, { $set: { status: "CLOSED", closedAt: new Date(), applied: apply } });
    return { audit: await this.get(id), discrepancies: diff };
  }
}

export const inventoryAuditService = new InventoryAuditService();

// crm.model.ts => entidad Customer del CRM. Los DATOS TRANSACCIONALES (cliente, pedidos, LTV) salen de PostgreSQL
// (fuente de verdad: users + orders) y la ficha comercial (etiquetas, notas internas, scoring manual, archivo,
// vínculo con SuiteCRM) vive en MongoDB como CrmProfile: datos flexibles de interacción, sin tocar el esquema SQL.
import { Schema, model, type InferSchemaType } from "mongoose";

// Segmentos automáticos (patrón Strategy declarativo: la regla vive en una sola consulta SQL, ver crm.repository)
export const Segments = ["VIP", "REGULAR", "NEW", "INACTIVE"] as const;
export type Segment = (typeof Segments)[number];

// Umbrales de segmentación (una sola fuente para el SQL y para las pruebas: DRY)
export const SEGMENT_RULES = {
  vipOrders: 5, // 5 pedidos o más => VIP
  vipLtvCents: 200_000_000, // o $2.000.000 COP de valor de vida (en unidad mínima)
  inactiveDays: 90, // Sin compras en 90 días => INACTIVE
  newDays: 30, // Registrado hace menos de 30 días => NEW
} as const;

const crmProfileSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true }, // ID del usuario en PostgreSQL
    tags: { type: [String], default: [] },
    notes: { type: [{ text: { type: String, maxlength: 1_000 }, authorId: String, at: Date, _id: false }], default: [] },
    score: { type: Number, min: 0, max: 100, default: null }, // Scoring MANUAL (null => se usa el automático RFM)
    archivedAt: { type: Date, default: null }, // DELETE de la matriz = archivar (la cuenta del cliente no se toca)
    suiteCrmId: { type: String, default: null }, // ID del contacto en SuiteCRM (si la integración está activa)
  },
  { timestamps: true, versionKey: false }
);
crmProfileSchema.index({ tags: 1 }); // Filtro por etiqueta (índice multikey)
crmProfileSchema.index({ archivedAt: 1 }, { partialFilterExpression: { archivedAt: { $type: "date" } } }); // Solo archivados

export type CrmProfileRecord = InferSchemaType<typeof crmProfileSchema>;
export const CrmProfileModel = model("CrmProfile", crmProfileSchema);

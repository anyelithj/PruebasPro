// marketing.model.ts (Mongoose / MongoDB) => Campaign: campaña con audiencia (segmento del CRM), canal, contenido,
// programación y métricas. MongoDB: documento autocontenido con contenido flexible (HTML, plantillas, variables).
import { Schema, model, type InferSchemaType } from "mongoose";
import { Segments } from "../../crm/model/crm.model";

// Canales (patrón Strategy en el service: cada canal envía a su manera)
export const Channels = ["EMAIL", "PUSH", "WHATSAPP"] as const;
export type Channel = (typeof Channels)[number];

// Audiencias: todos los clientes con opt-in o un segmento automático del CRM
export const Audiences = ["ALL", ...Segments] as const;
// RF-22.2 además de los automáticos, un segmento personalizado del CRM: "SEGMENT:<id>"
export type Audience = (typeof Audiences)[number] | `SEGMENT:${string}`;

// Estados de la campaña (patrón State): DRAFT -> SCHEDULED -> SENDING -> SENT | FAILED ; cualquiera -> ARCHIVED
// TESTING => RF-21.4 prueba A/B enviada a una muestra; espera para elegir la variante ganadora
export const CampaignStatuses = ["DRAFT", "SCHEDULED", "SENDING", "TESTING", "SENT", "FAILED", "ARCHIVED"] as const;
export type CampaignStatus = (typeof CampaignStatuses)[number];

const campaignSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 120 },
    channel: { type: String, enum: Channels, required: true },
    audience: { type: String, default: "ALL", validate: (value: string) => (Audiences as readonly string[]).includes(value) || /^SEGMENT:[a-f0-9]{24}$/i.test(value) },
    subject: { type: String, required: true, maxlength: 200 }, // Asunto (email) o título (push/WhatsApp)
    content: { type: String, required: true, maxlength: 100_000 }, // HTML (email) o texto; admite "{{ firstName }}"
    templateId: { type: Schema.Types.ObjectId, default: null }, // Plantilla de Email usada como base (opcional)
    url: { type: String, default: null, maxlength: 500 }, // Enlace de destino (push / WhatsApp)
    status: { type: String, enum: CampaignStatuses, default: "DRAFT" },
    scheduledAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    // Métricas propias del envío (aperturas de email se calculan del historial del módulo Email)
    metrics: {
      targeted: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    error: { type: String, default: null },
    costCents: { type: Number, default: 0 }, // RF-24.3 inversión de la campaña (para el ROI)
    // RF-21.4 prueba A/B: asunto/contenido alterno, % de la audiencia de prueba, métrica y espera para decidir
    abTest: {
      type: new Schema(
        {
          subjectB: { type: String, required: true, maxlength: 200 },
          contentB: { type: String, default: null, maxlength: 100_000 }, // null => mismo contenido, solo cambia el asunto
          testPercent: { type: Number, min: 10, max: 50, default: 20 },
          metric: { type: String, enum: ["OPEN", "CLICK"], default: "OPEN" },
          waitHours: { type: Number, min: 1, max: 72, default: 4 },
          decideAt: { type: Date, default: null },
          winner: { type: String, enum: ["A", "B", null], default: null },
        },
        { _id: false }
      ),
      default: null,
    },
    createdBy: { type: String, required: true },
  },
  { timestamps: true, versionKey: false }
);
campaignSchema.index({ status: 1, scheduledAt: 1 }); // El job de campañas programadas consulta solo por este índice
campaignSchema.index({ status: 1, "abTest.decideAt": 1 }); // RF-21.4 pruebas A/B listas para decidir
campaignSchema.index({ createdAt: -1 });

export type CampaignRecord = InferSchemaType<typeof campaignSchema>;
export const CampaignModel = model("Campaign", campaignSchema);

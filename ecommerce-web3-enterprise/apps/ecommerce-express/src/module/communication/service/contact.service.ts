// contact.service.ts => RF-21.2 formulario de contacto de la tienda (público, sin cuenta):
//  - guarda el mensaje (MongoDB), avisa al equipo (bandeja + correo) y responde automáticamente al cliente
//  - el equipo lo atiende desde el panel: estado (NUEVO -> EN CURSO -> RESUELTO) y respuesta por correo
// Anti-spam: honeypot (campo oculto "website" que solo llenan los bots) + rate limit en la ruta.
// Patrones: Facade + State + Observer (notificación a administradores). Paradigma: POO + asíncrono.
import { Schema, model } from "mongoose";
import { prisma } from "../../../config/database.config";
import { emailService } from "../../email/service/email.service";
import { escapeHtml } from "../../email/util/template.util";
import { notificationService } from "../../notification/service/notification.service";
import { Roles } from "../../../shared/constants/roles.constants";
import { NotFoundException } from "../../../shared/filter/http-exception.filter";

export const ContactTopics = ["ORDER", "PRODUCT", "RETURN", "PAYMENT", "OTHER"] as const;
export const ContactStatuses = ["NEW", "IN_PROGRESS", "RESOLVED"] as const;

const contactSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 120 },
    email: { type: String, required: true, lowercase: true, maxlength: 200 },
    phone: { type: String, default: null, maxlength: 30 },
    topic: { type: String, enum: ContactTopics, default: "OTHER" },
    orderNumber: { type: String, default: null, maxlength: 40 },
    message: { type: String, required: true, maxlength: 5000 },
    status: { type: String, enum: ContactStatuses, default: "NEW" },
    reply: { type: String, default: null, maxlength: 5000 },
    repliedAt: { type: Date, default: null },
    repliedBy: { type: String, default: null },
    userId: { type: String, default: null }, // Si escribió con sesión iniciada
  },
  { timestamps: true, versionKey: false }
);
contactSchema.index({ status: 1, createdAt: -1 });
export const ContactMessageModel = model("ContactMessage", contactSchema);

type Topic = (typeof ContactTopics)[number];
type Status = (typeof ContactStatuses)[number];
const toDto = ({ _id, ...doc }: Record<string, unknown> & { _id: unknown }) => ({ id: String(_id), ...doc });

export class ContactService {
  public async create(input: { name: string; email: string; phone?: string | undefined; topic: Topic; orderNumber?: string | undefined; message: string; website?: string | undefined }, userId: string | null) {
    if (input.website) return { received: true }; // Honeypot lleno => bot: se responde igual (sin pistas) y no se guarda
    const doc = await ContactMessageModel.create({ ...input, website: undefined, phone: input.phone ?? null, orderNumber: input.orderNumber ?? null, userId });
    const admins = await prisma.user.findMany({ where: { isActive: true, roles: { some: { role: { name: Roles.ADMIN } } } }, select: { id: true } });
    void notificationService.broadcast(admins.map((admin) => admin.id), { type: "SYSTEM", message: { title: `Contacto: ${input.topic}`, body: `${input.name} <${input.email}>: ${input.message.slice(0, 200)}` }, url: "/dashboard/ai-assistant?tab=contact", channels: ["IN_APP", "EMAIL"] });
    // Acuse de recibo automático (el cliente sabe que llegó y cuándo esperar respuesta)
    void emailService
      .send(input.email, {
        subject: "Recibimos tu mensaje",
        html: `<p>Hola ${escapeHtml(input.name)}, recibimos tu mensaje y te responderemos en menos de 24 horas hábiles.</p><blockquote>${escapeHtml(input.message)}</blockquote>`,
        text: `Hola ${input.name}, recibimos tu mensaje y te responderemos en menos de 24 horas hábiles.`,
      })
      .catch(() => undefined);
    return { received: true, id: String(doc._id) };
  }

  public async list(status: Status | undefined, page: number, limit: number) {
    const where = status ? { status } : {};
    const [rows, total] = await Promise.all([ContactMessageModel.find(where).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), ContactMessageModel.countDocuments(where)]);
    return { items: rows.map((row) => toDto(row as never)), total };
  }

  // update => cambia el estado y, si trae respuesta, la envía por correo y la deja registrada (quién y cuándo)
  public async update(id: string, input: { status?: Status | undefined; reply?: string | undefined }, actorId: string) {
    const current = await ContactMessageModel.findById(id).lean();
    if (!current) throw new NotFoundException("ContactMessage", id);
    if (input.reply) {
      await emailService.send(current.email, { subject: "Respuesta a tu mensaje", html: `<p>${escapeHtml(input.reply).replace(/\n/g, "<br>")}</p>`, text: input.reply });
    }
    const doc = await ContactMessageModel.findByIdAndUpdate(
      id,
      { $set: { ...(input.status ? { status: input.status } : {}), ...(input.reply ? { reply: input.reply, repliedAt: new Date(), repliedBy: actorId, status: input.status ?? "RESOLVED" } : {}) } },
      { new: true }
    ).lean();
    return toDto(doc as never);
  }
}

export const contactService = new ContactService();

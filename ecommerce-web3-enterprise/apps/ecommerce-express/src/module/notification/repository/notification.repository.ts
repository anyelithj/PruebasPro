// notification.repository.ts => bandeja en MongoDB (Mongoose) + preferencias y tokens push en PostgreSQL (Prisma).
// Persistencia políglota detrás de UN repository: el service no sabe qué motor guarda cada dato (DIP).
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../../../config/database.config";
import { NotificationModel, type NotificationChannel, type NotificationType } from "../model/notification.model";
import type { NotificationPreferencesDto } from "../dto/notification.dto";
import type { Locale } from "../../../shared/util/i18n.util";
import type { PageParams, Paginated } from "../../../shared/types/pagination.types";

export class NotificationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // createOrGroup => RF-16.5 suma la ocurrencia al grupo abierto (mismo groupKey, no leído, dentro de la ventana) con
  // UNA operación atómica ($inc); si no hay grupo, crea el registro. Devuelve la fila resultante.
  public async createOrGroup(input: Parameters<NotificationRepository["create"]>[0] & { groupKey: string }, windowMs: number): Promise<NotificationRow> {
    const now = new Date();
    const grouped = await NotificationModel.findOneAndUpdate(
      { userId: input.userId, groupKey: input.groupKey, readAt: null, lastAt: { $gte: new Date(now.getTime() - windowMs) } },
      { $inc: { count: 1 }, $set: { lastAt: now, params: input.params, title: input.title, body: input.body } },
      { new: true }
    ).lean();
    return grouped ? toRow(grouped) : this.create(input);
  }

  public async create(input: {
    userId: string;
    type: NotificationType;
    messageKey: string | null;
    params: unknown;
    title: string;
    body: string;
    url?: string | undefined;
    data?: Record<string, unknown> | undefined;
    channels: NotificationChannel[];
    groupKey?: string;
  }): Promise<NotificationRow> {
    const doc = await NotificationModel.create({ ...input, url: input.url ?? null, data: input.data ?? {} });
    return toRow(doc);
  }

  public async findMany(userId: string, unreadOnly: boolean, page: PageParams): Promise<Paginated<NotificationRow>> {
    const filter = { userId, ...(unreadOnly ? { readAt: null } : {}) };
    const [docs, total] = await Promise.all([
      NotificationModel.find(filter).sort({ lastAt: -1, createdAt: -1 }).skip(page.skip).limit(page.limit).lean(), // "lean" => objetos planos (más rápido)
      NotificationModel.countDocuments(filter),
    ]);
    return { items: docs.map(toRow), total };
  }

  public async unreadCount(userId: string): Promise<number> {
    return NotificationModel.countDocuments({ userId, readAt: null });
  }

  // markRead => solo si pertenece al usuario (el filtro incluye userId: ownership en la propia consulta)
  public async markRead(id: string, userId: string): Promise<NotificationRow | null> {
    const doc = await NotificationModel.findOneAndUpdate({ _id: id, userId }, { readAt: new Date() }, { new: true }).lean();
    return doc ? toRow(doc) : null;
  }

  public async markAllRead(userId: string): Promise<number> {
    return (await NotificationModel.updateMany({ userId, readAt: null }, { readAt: new Date() })).modifiedCount;
  }

  public async delete(id: string, userId: string): Promise<boolean> {
    return (await NotificationModel.deleteOne({ _id: id, userId })).deletedCount > 0;
  }

  public async clear(userId: string): Promise<number> {
    return (await NotificationModel.deleteMany({ userId })).deletedCount;
  }

  // --- Preferencias y destinatarios (PostgreSQL) ---

  public async preferences(userId: string): Promise<NotificationPreferencesDto> {
    // "upsert" => usuarios anteriores al módulo obtienen preferencias por defecto al primer acceso
    const row = await this.prisma.notificationPreference.upsert({ where: { userId }, update: {}, create: { userId } });
    return toPrefs(row);
  }

  public async updatePreferences(userId: string, changes: Partial<NotificationPreferencesDto>): Promise<NotificationPreferencesDto> {
    const row = await this.prisma.notificationPreference.upsert({ where: { userId }, update: changes, create: { userId, ...changes } });
    return toPrefs(row);
  }

  // recipient => datos de entrega, incluido el idioma preferido (emails y push se redactan en ese idioma)
  // recipient => incluye el celular SOLO si está verificado (RF-01.1): WhatsApp/SMS nunca van a un número sin confirmar
  public async recipient(userId: string): Promise<{ email: string; firstName: string; isActive: boolean; locale: Locale; phone: string | null } | null> {
    const row = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true, isActive: true, locale: true, phone: true, phoneVerifiedAt: true } });
    return row ? { email: row.email, firstName: row.firstName, isActive: row.isActive, locale: row.locale === "en" ? "en" : "es", phone: row.phoneVerifiedAt ? row.phone : null } : null;
  }

  public async pushTokens(userId: string): Promise<string[]> {
    return (await this.prisma.pushToken.findMany({ where: { userId }, select: { token: true } })).map((row) => row.token);
  }

  public async savePushToken(userId: string, token: string, platform: string): Promise<void> {
    // El mismo token puede cambiar de dueño (dispositivo compartido): se reasigna al usuario actual
    await this.prisma.pushToken.upsert({ where: { token }, update: { userId, platform }, create: { userId, token, platform } });
  }

  public async deletePushTokens(tokens: string[]): Promise<void> {
    if (tokens.length > 0) await this.prisma.pushToken.deleteMany({ where: { token: { in: tokens } } });
  }
}

// NotificationRow => registro persistido (sin redactar): el service lo convierte a DTO en el idioma pedido
// toPrefs => fila de Prisma -> DTO (DRY entre lectura y actualización)
const toPrefs = (row: NotificationPreferencesDto): NotificationPreferencesDto => ({ email: row.email, push: row.push, inApp: row.inApp, marketing: row.marketing, whatsapp: row.whatsapp, sms: row.sms });

export interface NotificationRow {
  id: string;
  type: NotificationType;
  messageKey: string | null;
  params: unknown;
  title: string;
  body: string;
  url: string | null;
  readAt: Date | null;
  createdAt: Date;
  count: number; // RF-16.5 ocurrencias agrupadas
}

function toRow(doc: { _id: unknown; type: string; messageKey?: string | null; params?: unknown; title: string; body: string; url?: string | null; readAt?: Date | null; createdAt?: Date; lastAt?: Date | null; count?: number | null }): NotificationRow {
  return {
    id: String(doc._id),
    type: doc.type as NotificationType,
    messageKey: doc.messageKey ?? null,
    params: doc.params ?? {},
    title: doc.title,
    body: doc.body,
    url: doc.url ?? null,
    readAt: doc.readAt ?? null,
    createdAt: doc.lastAt ?? doc.createdAt ?? new Date(), // La fecha visible es la de la última ocurrencia del grupo
    count: doc.count ?? 1,
  };
}

export const notificationRepository = new NotificationRepository(prisma);

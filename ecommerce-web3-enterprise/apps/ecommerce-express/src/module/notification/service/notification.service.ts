// notification.service.ts => notificaciones multicanal (sprint 4.2).
// Patrón STRATEGY: cada canal (IN_APP, EMAIL, PUSH) implementa la misma interfaz; el service elige los canales
// según el tipo de notificación y las PREFERENCIAS del usuario. Agregar WhatsApp = una estrategia nueva (OCP).
import axios, { AxiosError } from "axios";
import jwt from "jsonwebtoken";
import { notificationRepository, type NotificationRepository, type NotificationRow } from "../repository/notification.repository";
import { NotificationNotFoundException } from "../exception/notification.exception";
import type { NotificationChannel, NotificationType } from "../model/notification.model";
import type { NotificationDto, NotificationPreferencesDto, NotifyInput } from "../dto/notification.dto";
import { renderNotification, renderStoredNotification, type NotificationKey, type NotificationParams, type RenderedNotification } from "../../../shared/constants/messages.constants";
import { localizedPath, type Locale } from "../../../shared/util/i18n.util";
import { emailService } from "../../email/service/email.service";
import { EmailTemplates } from "../../email/util/template.util";
import { TypedEventBus } from "../../../shared/util/event-bus.util";
import { appConfig } from "../../../config/app.config";
import { buildPaginationMeta, toPageParams, type PaginationQuery } from "../../../shared/util/pagination.util";
import type { PaginationMeta } from "../../../shared/types/pagination.types";
import { logger } from "../../../shared/middleware/logger.middleware";
import type { PartialUpdate } from "../../../shared/types/common.types";
import { parseSubscription, sendWebPush } from "../../../shared/util/web-push.util";
import { whatsappProvider, type WhatsAppProvider } from "../provider/whatsapp.provider"; // RF-16.1
import { smsProvider, type SmsProvider } from "../provider/sms.provider"; // RF-16.1 (mismo transporte del RF-01.1)

const GROUP_WINDOW_MS = 6 * 60 * 60 * 1000; // RF-16.5 avisos iguales en 6 h se agrupan en uno

// Contexto de entrega que recibe cada estrategia (texto ya redactado en el idioma del destinatario)
interface Delivery {
  userId: string;
  email: string;
  phone: string | null; // Celular verificado (WhatsApp / SMS)
  locale: Locale;
  text: RenderedNotification;
  input: NotifyInput;
  saved: NotificationDto | null; // Registro in-app (si ese canal se usó)
}

// renderKeyed => genérico "<K>": correlaciona la clave con SUS parámetros sin conversiones de tipo
const renderKeyed = <K extends NotificationKey>(message: { key: K; params: NotificationParams[K] }, locale: Locale) =>
  renderNotification(locale, message.key, message.params);

// render => texto del mensaje en un idioma: clave traducible o texto libre de un administrador
function render(message: NotifyInput["message"], locale: Locale): RenderedNotification {
  return "key" in message ? renderKeyed(message, locale) : message;
}

// present => registro guardado -> DTO en el idioma de quien consulta (la bandeja cambia de idioma con la interfaz)
export function present(row: NotificationRow, locale: Locale): NotificationDto {
  const text = renderStoredNotification(locale, row.messageKey, row.params) ?? { title: row.title, body: row.body };
  return { id: row.id, type: row.type, title: text.title, body: text.body, url: row.url, read: Boolean(row.readAt), createdAt: row.createdAt, count: row.count };
}

// deepLink => URL absoluta del frontend en el idioma del destinatario (emails y push)
const deepLink = (delivery: Delivery): string | undefined =>
  delivery.input.url ? `${appConfig.FRONTEND_URL}${localizedPath(delivery.locale, delivery.input.url)}` : undefined;

interface ChannelStrategy {
  send(delivery: Delivery): Promise<void>;
}

// liveNotifications => bus en memoria de notificaciones recién guardadas (Publish-Subscribe). Lo consume la
// GraphQL Subscription "notificationReceived" (graphql.config.ts), que entrega a cada usuario solo las suyas.
export const liveNotifications = new TypedEventBus<{ "notification.created": { userId: string; notification: NotificationDto } }>(
  "notification-live"
);

// --- IN_APP: el registro ya se guardó en Mongo; aquí se publica en tiempo real (GraphQL Subscription por WebSocket) ---
class InAppChannel implements ChannelStrategy {
  public async send(delivery: Delivery): Promise<void> {
    if (delivery.saved) liveNotifications.emit("notification.created", { userId: delivery.userId, notification: delivery.saved });
  }
}

// --- EMAIL: plantilla genérica con enlace profundo al frontend ---
class EmailChannel implements ChannelStrategy {
  public async send(delivery: Delivery): Promise<void> {
    await emailService.send(delivery.email, EmailTemplates.notification(delivery.locale, { ...delivery.text, url: deepLink(delivery) }));
  }
}

// --- PUSH: Firebase Cloud Messaging HTTP v1 (OAuth2 con cuenta de servicio firmada RS256; sin SDK extra) y Web Push
// estándar con VAPID para la PWA de Nuxt (suscripciones guardadas como JSON en el mismo registro de tokens) ---
class PushChannel implements ChannelStrategy {
  private cachedToken: { value: string; expiresAt: number } | null = null;

  constructor(private readonly repository: NotificationRepository) {}

  public async send(delivery: Delivery): Promise<void> {
    const tokens = await this.repository.pushTokens(delivery.userId);
    if (tokens.length === 0) return;
    // Strategy por tipo de token: suscripción Web Push (JSON) o token FCM
    const webTokens = tokens.filter((token) => parseSubscription(token));
    const fcmTokens = tokens.filter((token) => !parseSubscription(token));
    const invalid = [...(await this.sendWebPush(webTokens, delivery)), ...(await this.sendFcm(fcmTokens, delivery))];
    await this.repository.deletePushTokens(invalid);
  }

  // sendWebPush => Web Push con VAPID; 404/410 => suscripción vencida (se borra). Sin llaves VAPID se omite.
  private async sendWebPush(tokens: string[], delivery: Delivery): Promise<string[]> {
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = appConfig;
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || tokens.length === 0) return [];
    const keys = { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY, subject: VAPID_SUBJECT };
    const results = await Promise.all(
      tokens.map(async (token) => {
        const status = await sendWebPush(parseSubscription(token) as NonNullable<ReturnType<typeof parseSubscription>>, { title: delivery.text.title, body: delivery.text.body, url: delivery.input.url ? deepLink(delivery) : "/" }, keys).catch(() => 0);
        return status === 404 || status === 410 ? token : null;
      })
    );
    return results.filter((token): token is string => token !== null);
  }

  // sendFcm => Firebase Cloud Messaging (apps móviles / navegadores con el SDK de Firebase)
  private async sendFcm(tokens: string[], delivery: Delivery): Promise<string[]> {
    const { FCM_PROJECT_ID } = appConfig;
    if (!FCM_PROJECT_ID || tokens.length === 0) return []; // Push no configurado: el canal se omite silenciosamente

    const accessToken = await this.accessToken();
    const invalid: string[] = [];
    await Promise.all(
      tokens.map(async (token) => {
        try {
          await axios.post(
            `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`,
            {
              message: {
                token,
                notification: { title: delivery.text.title, body: delivery.text.body },
                webpush: delivery.input.url ? { fcm_options: { link: deepLink(delivery) } } : undefined,
              },
            },
            { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 5000 }
          );
        } catch (error) {
          // 404/400 UNREGISTERED => token vencido (app desinstalada, permisos revocados): se elimina
          if (error instanceof AxiosError && (error.response?.status === 404 || error.response?.status === 400)) invalid.push(token);
        }
      })
    );
    return invalid;
  }

  // accessToken => JWT firmado con la llave de la cuenta de servicio, canjeado por un token OAuth2 (cacheado ~1 h)
  private async accessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60_000) return this.cachedToken.value;
    const privateKey = (appConfig.FCM_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"); // Las variables de entorno guardan "\n" escapado
    const assertion = jwt.sign(
      { scope: "https://www.googleapis.com/auth/firebase.messaging" },
      privateKey,
      { algorithm: "RS256", issuer: appConfig.FCM_CLIENT_EMAIL, audience: "https://oauth2.googleapis.com/token", expiresIn: "1h" }
    );
    const { data } = await axios.post<{ access_token: string; expires_in: number }>(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion })
    );
    this.cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
    return data.access_token;
  }
}

// --- WHATSAPP y SMS (RF-16.1): texto corto con el enlace profundo; sin celular verificado el canal se omite ---
class MessagingChannel implements ChannelStrategy {
  constructor(private readonly provider: WhatsAppProvider | SmsProvider) {}
  public async send(delivery: Delivery): Promise<void> {
    if (!delivery.phone) return;
    const link = deepLink(delivery);
    await this.provider.send(delivery.phone, `${delivery.text.title}\n${delivery.text.body}${link ? `\n${link}` : ""}`);
  }
}

// Canales por defecto según el tipo (la seguridad siempre llega por email aunque el usuario lo desactive)
const DEFAULT_CHANNELS: Record<NotificationType, NotificationChannel[]> = {
  // RF-20.8 seguimiento del pedido por varios canales (WhatsApp/SMS solo si el cliente los activó)
  ORDER: ["IN_APP", "EMAIL", "PUSH", "WHATSAPP", "SMS"],
  PAYMENT: ["IN_APP", "EMAIL"],
  SHIPPING: ["IN_APP", "EMAIL", "PUSH", "WHATSAPP", "SMS"],
  REFUND: ["IN_APP", "EMAIL"],
  REVIEW: ["IN_APP"],
  LOYALTY: ["IN_APP", "PUSH"],
  SECURITY: ["IN_APP", "EMAIL"],
  PROMOTION: ["IN_APP", "EMAIL", "PUSH", "WHATSAPP"],
  SYSTEM: ["IN_APP"],
};

export class NotificationService {
  private readonly channels: Record<NotificationChannel, ChannelStrategy>;

  constructor(private readonly repository: NotificationRepository) {
    // Registro de estrategias (Composition Root del módulo)
    this.channels = { IN_APP: new InAppChannel(), EMAIL: new EmailChannel(), PUSH: new PushChannel(repository), WHATSAPP: new MessagingChannel(whatsappProvider), SMS: new MessagingChannel(smsProvider) };
  }

  // notify => punto de entrada único para TODOS los módulos (Facade)
  public async notify(userId: string, input: NotifyInput): Promise<void> {
    const recipient = await this.repository.recipient(userId);
    if (!recipient?.isActive) return; // Cuentas desactivadas/anonimizadas no reciben nada

    const prefs = await this.repository.preferences(userId);
    const channels = this.resolveChannels(input.type, input.channels ?? DEFAULT_CHANNELS[input.type], prefs);
    if (channels.length === 0) return;

    // Texto en el idioma preferido del destinatario (emails, push y el aviso en tiempo real)
    const text = render(input.message, recipient.locale);
    const saved = channels.includes("IN_APP") ? present(await this.saveInApp(userId, input, text, channels), recipient.locale) : null;
    const delivery = { userId, email: recipient.email, phone: recipient.phone, locale: recipient.locale, text, input, saved };
    // "Promise.allSettled" => un canal caído (SMTP, FCM) no impide la entrega por los otros
    const results = await Promise.allSettled(channels.map((channel) => this.channels[channel].send(delivery)));
    results.forEach((result, index) => {
      if (result.status === "rejected") logger.warn("notification_channel_failed", { channel: channels[index], userId, reason: String(result.reason) });
    });
  }

  // saveInApp => guarda en la bandeja la clave + parámetros (traducibles al leer) y el texto ya redactado de respaldo.
  // RF-16.5 "groupKey" = tipo + clave (o título libre) + enlace: varios "tu pedido cambió de estado" del MISMO pedido o
  // "bajó de precio" del mismo producto se agrupan; avisos de seguridad nunca se agrupan (cada uno importa)
  private saveInApp(userId: string, input: NotifyInput, text: RenderedNotification, channels: NotificationChannel[]): Promise<NotificationRow> {
    const keyed = "key" in input.message ? input.message : null;
    const row = { userId, type: input.type, messageKey: keyed?.key ?? null, params: keyed?.params ?? {}, ...text, url: input.url, data: input.data, channels };
    if (input.type === "SECURITY") return this.repository.create(row);
    return this.repository.createOrGroup({ ...row, groupKey: `${input.type}:${keyed?.key ?? text.title}:${input.url ?? ""}` }, GROUP_WINDOW_MS);
  }

  // createNotification => "crear y enviar notificación push/email/WhatsApp" (admin, envío a varios usuarios)
  public async broadcast(userIds: string[], input: NotifyInput): Promise<{ queued: number }> {
    // Envío en lotes de 50 para no saturar SMTP/FCM (control de concurrencia simple)
    for (let index = 0; index < userIds.length; index += 50) {
      await Promise.all(userIds.slice(index, index + 50).map((userId) => this.notify(userId, input)));
    }
    return { queued: userIds.length };
  }

  // listNotifications => "notificaciones del usuario paginadas"
  public async listNotifications(userId: string, query: PaginationQuery & { unread?: boolean | undefined }, locale: Locale): Promise<{ items: NotificationDto[]; meta: PaginationMeta; unreadCount: number }> {
    const page = toPageParams(query);
    const [{ items, total }, unreadCount] = await Promise.all([
      this.repository.findMany(userId, query.unread ?? false, page),
      this.repository.unreadCount(userId),
    ]);
    return { items: items.map((row) => present(row, locale)), meta: buildPaginationMeta(page, total), unreadCount };
  }

  public async unreadCount(userId: string): Promise<number> {
    return this.repository.unreadCount(userId);
  }

  // updateNotification => "marcar notificación como leída — PATCH parcial"
  public async markRead(id: string, userId: string, locale: Locale): Promise<NotificationDto> {
    const updated = await this.repository.markRead(id, userId);
    if (!updated) throw new NotificationNotFoundException(id);
    return present(updated, locale);
  }

  public async markAllRead(userId: string): Promise<{ updated: number }> {
    return { updated: await this.repository.markAllRead(userId) };
  }

  // deleteNotificationById => "eliminar notificación del inbox"
  public async deleteNotification(id: string, userId: string): Promise<void> {
    if (!(await this.repository.delete(id, userId))) throw new NotificationNotFoundException(id);
  }

  // deleteAllNotifications => "limpiar inbox completo"
  public async clearInbox(userId: string): Promise<{ deleted: number }> {
    return { deleted: await this.repository.clear(userId) };
  }

  public async getPreferences(userId: string): Promise<NotificationPreferencesDto> {
    return this.repository.preferences(userId);
  }

  // "PartialUpdate" => acepta campos opcionales o undefined (tal como los entrega Zod) y aquí se descartan los undefined
  public async updatePreferences(userId: string, changes: PartialUpdate<NotificationPreferencesDto>): Promise<NotificationPreferencesDto> {
    const defined = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined)) as Partial<NotificationPreferencesDto>;
    return this.repository.updatePreferences(userId, defined);
  }

  public async registerPushToken(userId: string, token: string, platform: string): Promise<void> {
    await this.repository.savePushToken(userId, token, platform);
  }

  public async removePushToken(token: string): Promise<void> {
    await this.repository.deletePushTokens([token]);
  }

  // resolveChannels => aplica las preferencias (SECURITY siempre por email; PROMOTION exige opt-in de marketing)
  private resolveChannels(type: NotificationType, requested: NotificationChannel[], prefs: NotificationPreferencesDto): NotificationChannel[] {
    if (type === "PROMOTION" && !prefs.marketing) return [];
    return requested.filter((channel) => {
      if (channel === "EMAIL") return prefs.email || type === "SECURITY";
      if (channel === "PUSH") return prefs.push;
      if (channel === "WHATSAPP") return prefs.whatsapp; // RF-16.1 opt-in explícito
      if (channel === "SMS") return prefs.sms;
      return prefs.inApp;
    });
  }
}

export const notificationService = new NotificationService(notificationRepository);

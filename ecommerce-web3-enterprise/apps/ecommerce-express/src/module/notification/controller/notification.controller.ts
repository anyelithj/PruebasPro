// notification.controller.ts => capa HTTP de la bandeja de notificaciones y sus preferencias.
import type { Request, Response } from "express";
import { notificationService } from "../service/notification.service";
import {
  CreateNotificationSchema,
  ListNotificationsQuerySchema,
  ObjectIdSchema,
  PushTokenSchema,
  UpdatePreferencesSchema,
} from "../schema/notification.schema";
import { asyncHandler, sendNoContent, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { currentUser } from "../../../shared/decorator/auth.decorator";
import { HttpStatus } from "../../../shared/constants/http.constants";
import { requestLocale } from "../../../shared/util/i18n.util";

export class NotificationController {
  // createNotification => POST /api/v1/notification (admin)
  public readonly createNotification = asyncHandler(async (req: Request, res: Response) => {
    // Mensaje libre del administrador: se entrega tal cual lo escribió (sin clave de traducción)
    const { userIds, title, body, ...rest } = CreateNotificationSchema.parse(req.body);
    sendSuccess(res, await notificationService.broadcast(userIds, { ...rest, message: { title, body } }), HttpStatus.ACCEPTED);
  });

  // listNotifications => GET /api/v1/notification?unread=true
  public readonly listNotifications = asyncHandler(async (req: Request, res: Response) => {
    const { items, meta, unreadCount } = await notificationService.listNotifications(currentUser(req).id, ListNotificationsQuerySchema.parse(req.query), requestLocale(req)); // Idioma de la interfaz (Accept-Language)
    res.setHeader("X-Unread-Count", unreadCount); // El badge de la campana lo lee sin otra petición
    sendSuccess(res, items, HttpStatus.OK, meta);
  });

  public readonly unreadCount = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, { unreadCount: await notificationService.unreadCount(currentUser(req).id) });
  });

  // updateNotification => PATCH /api/v1/notification/:id/read
  public readonly markRead = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await notificationService.markRead(ObjectIdSchema.parse(req.params["id"]), currentUser(req).id, requestLocale(req)));
  });

  public readonly markAllRead = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await notificationService.markAllRead(currentUser(req).id));
  });

  public readonly deleteNotification = asyncHandler(async (req: Request, res: Response) => {
    await notificationService.deleteNotification(ObjectIdSchema.parse(req.params["id"]), currentUser(req).id);
    sendNoContent(res);
  });

  // deleteAllNotifications => DELETE /api/v1/notification
  public readonly clearInbox = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await notificationService.clearInbox(currentUser(req).id));
  });

  public readonly getPreferences = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await notificationService.getPreferences(currentUser(req).id));
  });

  public readonly updatePreferences = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await notificationService.updatePreferences(currentUser(req).id, UpdatePreferencesSchema.parse(req.body)));
  });

  public readonly registerPushToken = asyncHandler(async (req: Request, res: Response) => {
    const { token, platform } = PushTokenSchema.parse(req.body);
    await notificationService.registerPushToken(currentUser(req).id, token, platform);
    sendNoContent(res);
  });

  public readonly removePushToken = asyncHandler(async (req: Request, res: Response) => {
    await notificationService.removePushToken(PushTokenSchema.pick({ token: true }).parse(req.body).token);
    sendNoContent(res);
  });
}

export const notificationController = new NotificationController();

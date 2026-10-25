// notification.route.ts => bandeja y preferencias del usuario autenticado; envío masivo con permiso RBAC.
import { Router } from "express";
import { notificationController } from "../controller/notification.controller";
import { jwtAuthGuard } from "../../auth/guard/auth.guard";
import { requirePermission } from "../../../shared/middleware/rbac.middleware";

export const notificationRouter = Router();
notificationRouter.use(jwtAuthGuard);

// Rutas literales primero (Express evalúa en orden de declaración)
notificationRouter.get("/unread-count", notificationController.unreadCount);
notificationRouter.get("/preferences", notificationController.getPreferences);
notificationRouter.patch("/preferences", notificationController.updatePreferences);
notificationRouter.post("/push-token", notificationController.registerPushToken);
notificationRouter.delete("/push-token", notificationController.removePushToken);
notificationRouter.patch("/read-all", notificationController.markAllRead);

notificationRouter.post("/", requirePermission("CREATE", "notification"), notificationController.createNotification);
notificationRouter.get("/", notificationController.listNotifications);
notificationRouter.delete("/", notificationController.clearInbox);
notificationRouter.patch("/:id/read", notificationController.markRead);
notificationRouter.delete("/:id", notificationController.deleteNotification);

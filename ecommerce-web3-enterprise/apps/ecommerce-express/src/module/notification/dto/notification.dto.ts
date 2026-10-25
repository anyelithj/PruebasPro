// notification.dto.ts => contratos de salida del módulo Notification (NotificationBell, NotificationList, Toast).
import type { NotificationChannel, NotificationType } from "../model/notification.model";
import type { NotificationKey, NotificationParams } from "../../../shared/constants/messages.constants";

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  url: string | null;
  read: boolean;
  createdAt: Date;
  count: number; // RF-16.5 avisos similares agrupados (1 = sin agrupar)
}

// KeyedMessage => unión DISTRIBUTIVA: { key: "orderPlaced"; params: {...de orderPlaced} } | ... (los parámetros
// deben corresponder exactamente a la clave: el compilador rechaza combinaciones inválidas)
export type KeyedMessage = { [K in NotificationKey]: { key: K; params: NotificationParams[K] } }[NotificationKey];
// FreeTextMessage => texto libre escrito por un administrador (se muestra tal cual, en el idioma en que se escribió)
export interface FreeTextMessage {
  title: string;
  body: string;
}

// NotifyInput => lo que publica cualquier módulo para notificar a un usuario
export type NotifyInput = {
  type: NotificationType;
  message: KeyedMessage | FreeTextMessage;
  url?: string | undefined;
  data?: Record<string, unknown> | undefined;
  channels?: NotificationChannel[] | undefined;
};

export interface NotificationPreferencesDto {
  email: boolean;
  push: boolean;
  inApp: boolean;
  marketing: boolean;
  whatsapp: boolean; // RF-16.1
  sms: boolean;
}

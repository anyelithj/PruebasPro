// [DRY] constantes de rutas de notificaciones
export const NOTIFICATION_ROUTES = {
  ROOT: 'notifications',
  BY_ID: ':id',
  WEBHOOK: 'webhook/:provider',
} as const;

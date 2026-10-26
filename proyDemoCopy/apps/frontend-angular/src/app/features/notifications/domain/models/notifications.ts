import * as z from 'zod'; // [Tree-shaking · Zod 4]: import de namespace (`* as z`) → esbuild empaqueta solo las funciones usadas (con `{ z }` arrastraba Zod entero, ~450 kB)
// [Modelo Notifications · Dominio]: aviso persistido y bandeja (contrato de /api/notifications/*) + reglas puras de la bandeja | [Patrón]: Schema-First (Zod) | [Principio]: SSOT + Type-Safe | [Paradigma]: Funcional (inmutable: cada regla devuelve una bandeja nueva)

export const NotificationSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  isRead: z.boolean(),
  createdAt: z.string(),
  // `payload.href`: a dónde lleva el aviso (p. ej. /admin/reports) | `nullish`: el backend envía null o lo omite
  payload: z.object({ href: z.string().optional() }).passthrough().nullish(),
});
export type AppNotification = z.infer<typeof NotificationSchema>; // «AppNotification» evita chocar con la Notification API del DOM

export const InboxSchema = z.object({ items: z.array(NotificationSchema), unread: z.number().int().nonnegative() });
export type Inbox = z.infer<typeof InboxSchema>;

// [receive]: aviso en vivo → arriba de la lista; ignora duplicados (reenvío por Last-Event-ID)
export function receive(inbox: Inbox, n: AppNotification): Inbox {
  if (inbox.items.some((i) => i.id === n.id)) return inbox;
  return { items: [n, ...inbox.items], unread: inbox.unread + (n.isRead ? 0 : 1) };
}

// [markOne]: marca un aviso como leído (sin tocar los demás)
export function markOne(inbox: Inbox, id: string): Inbox {
  const target = inbox.items.find((i) => i.id === id);
  if (!target || target.isRead) return inbox;
  return { items: inbox.items.map((i) => (i.id === id ? { ...i, isRead: true } : i)), unread: Math.max(0, inbox.unread - 1) };
}

// [markAll]: bandeja completa leída
export const markAll = (inbox: Inbox): Inbox => ({ items: inbox.items.map((i) => ({ ...i, isRead: true })), unread: 0 });

// [isInternalHref]: solo rutas relativas del sitio → nunca se navega a un dominio externo desde un aviso | [Seguridad]: evita open redirect
export const isInternalHref = (href: string | undefined): href is string => !!href && href.startsWith('/') && !href.startsWith('//');

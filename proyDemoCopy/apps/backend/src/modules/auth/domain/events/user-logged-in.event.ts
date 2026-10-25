// [Domain Event UserLoggedIn]: emitido tras login exitoso | [Patrón]: Observer + Domain Event | [Principio]: SRP + OCP | [Paradigma]: Event-Driven

export const USER_LOGGED_IN_EVENT = 'auth.user.logged-in';

// [Payload]: data mínima útil para listeners (analytics, audit log) | [Principio]: inmutabilidad
export class UserLoggedInEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly sessionId: string,
    // [Contexto opcional]: para detectar logins anómalos en futuras iteraciones
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
    public readonly occurredAt: Date = new Date(),
  ) {}
}

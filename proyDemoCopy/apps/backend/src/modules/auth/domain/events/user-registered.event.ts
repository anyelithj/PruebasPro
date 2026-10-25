import { Role } from '../../../users/domain/value-objects/role.vo';
// [Domain Event UserRegistered]: emitido tras registro exitoso | [Patrón]: Observer + Domain Event | [Principio]: SRP + OCP | [Paradigma]: Event-Driven

// [Nombre canónico]: usado por EventEmitter2 como wildcard pattern
export const USER_REGISTERED_EVENT = 'auth.user.registered';

// [Payload inmutable]: VO transportado en el evento | [Principio]: inmutabilidad
export class UserRegisteredEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly role: Role,
    // [Marca temporal]: trazabilidad y deduplicación si se publica a bus externo
    public readonly occurredAt: Date = new Date(),
  ) {}
}

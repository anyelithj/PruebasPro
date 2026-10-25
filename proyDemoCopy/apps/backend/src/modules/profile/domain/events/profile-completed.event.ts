// [Evento de dominio]: emitido cuando el perfil pasa a estar "completo" (todos los campos no nulos)
// | [Patrón]: Domain Event | [Principio]: SRP | [Paradigma]: Event-Driven

export class ProfileCompletedEvent {
  // [Static name]: SSOT para el nombre del evento (evita strings sueltos)
  static readonly EVENT_NAME = 'profile.completed';

  constructor(
    public readonly userId: string,
    public readonly fullName: string,
    public readonly completedAt: Date,
  ) {}
}

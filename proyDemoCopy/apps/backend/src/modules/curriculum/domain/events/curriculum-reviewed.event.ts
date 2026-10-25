// [Evento de dominio CurriculumReviewed]: un administrador publicó o devolvió un recurso → otros contextos reaccionan (p. ej. notificar al autor) | [Patrón]: Domain Event + Observer | [Principio]: OCP (nuevos suscriptores sin tocar el productor) | [Paradigma]: Event-Driven

// `export const` (ES Modules): nombre del evento como SSOT (productor y suscriptores importan la misma constante)
export const CURRICULUM_REVIEWED_EVENT = 'curriculum.reviewed';

// `export class` (TS): payload inmutable (`readonly`) del evento
export class CurriculumReviewedEvent {
  constructor(
    public readonly itemId: string, // Recurso revisado
    public readonly authorId: string, // Quién lo creó (destinatario de la notificación)
    public readonly topic: string, // Tema, para un mensaje legible
    public readonly approved: boolean, // true = publicado · false = devuelto con cambios
    public readonly note: string | null, // Comentario del revisor
  ) {}
}

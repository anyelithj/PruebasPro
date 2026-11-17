// [Evento de dominio CurriculumItemsChanged · 2026-11-13 · Tarea 9 · RF-57/RF-139]: uno o más recursos del temario se crearon, editaron, cambiaron de estado o se borraron
// → el índice RAG del tutor se pone al día (alta manual, importación por archivo e importación por enlace comparten este ÚNICO flujo)
// [Patrón]: Domain Event + Observer | [Principio]: OCP (Curriculum no conoce a FastAPI) + SRP | [Paradigma]: Event-Driven

// `export const` (ES Modules): nombre del evento como SSOT (productor y suscriptores importan la misma constante)
export const CURRICULUM_ITEMS_CHANGED_EVENT = 'curriculum.items.changed';

// `export class` (TS): payload inmutable (`readonly`) del evento
export class CurriculumItemsChangedEvent {
  constructor(
    public readonly ids: ReadonlyArray<string>, // Recursos afectados (el índice relee su estado actual de la BD)
    public readonly actorId: string | null, // Autor del cambio (TEACHER/ADMIN); null = proceso del sistema
  ) {}
}

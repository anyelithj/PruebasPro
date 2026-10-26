// [Value Object ReviewStatus]: flujo editorial del contenido como máquina de estados finita (Etapa 2 de la especificación MCER) | [Patrón]: State Machine (tabla de transiciones) + Value Object | [Principio]: SRP + OCP | [Paradigma]: Declarativo + Funcional (funciones puras)

// `export enum` (TS): estados editoriales posibles | el valor en minúsculas es el que guarda PostgreSQL (enum curriculum_items_review_status_enum)
export enum ReviewStatus {
  DRAFT = 'draft', // Borrador: creado o editado a mano; invisible para estudiantes
  GENERATED = 'generated', // Generado por IA y aún sin revisar: nunca se presenta como verificado
  REVIEW_REQUIRED = 'review_required', // Enviado a revisión (o marcado REQUIERE_REVISION)
  REVIEWED = 'reviewed', // Revisado por un docente; espera la aprobación del administrador
  APPROVED = 'approved', // Aprobado: ÚNICO estado visible para estudiantes
  ARCHIVED = 'archived', // Retirado sin borrarse (conserva historial)
}

// [Transiciones permitidas]: `ReadonlyArray` (TS) evita modificarlas por accidente | [Patrón]: Transition Table
// Volver a DRAFT desde REVIEW_REQUIRED o REVIEWED = «devolver con cambios» (exige nota; ver isReturn)
const TRANSITIONS: Readonly<Record<ReviewStatus, ReadonlyArray<ReviewStatus>>> =
  Object.freeze({
    [ReviewStatus.DRAFT]: [ReviewStatus.REVIEW_REQUIRED, ReviewStatus.ARCHIVED],
    [ReviewStatus.GENERATED]: [
      ReviewStatus.REVIEW_REQUIRED,
      ReviewStatus.DRAFT,
      ReviewStatus.ARCHIVED,
    ],
    [ReviewStatus.REVIEW_REQUIRED]: [
      ReviewStatus.REVIEWED,
      ReviewStatus.DRAFT,
      ReviewStatus.ARCHIVED,
    ],
    [ReviewStatus.REVIEWED]: [
      ReviewStatus.APPROVED,
      ReviewStatus.DRAFT,
      ReviewStatus.REVIEW_REQUIRED,
    ],
    [ReviewStatus.APPROVED]: [ReviewStatus.ARCHIVED, ReviewStatus.DRAFT],
    [ReviewStatus.ARCHIVED]: [ReviewStatus.DRAFT],
  });

// [Guard de transición]: función pura → mismo resultado para la misma entrada, sin efectos (fácil de testear)
export function canTransition(from: ReviewStatus, to: ReviewStatus): boolean {
  return TRANSITIONS[from].includes(to); // `includes` (ES2016): pertenencia en el array de destinos
}

// [Estados «en revisión»]: desde aquí volver a borrador es una devolución con comentario | `Object.freeze` (JS): inmutable en runtime
const IN_REVIEW: ReadonlyArray<ReviewStatus> = Object.freeze([
  ReviewStatus.REVIEW_REQUIRED,
  ReviewStatus.REVIEWED,
]);

// [isReturn]: ¿la transición devuelve el contenido al autor? (exige nota y la decide el administrador) | función pura
export const isReturn = (from: ReviewStatus, to: ReviewStatus): boolean =>
  to === ReviewStatus.DRAFT && IN_REVIEW.includes(from);

// [Estado inicial]: lo creado desde un borrador de IA nace GENERATED; lo manual o importado, DRAFT | [Principio]: nunca presentar contenido de IA como verificado
export const initialStatus = (fromAi: boolean): ReviewStatus =>
  fromAi ? ReviewStatus.GENERATED : ReviewStatus.DRAFT; // Operador ternario (JS)

// [Estados visibles para estudiantes]: `Object.freeze` (JS) congela el array en runtime | [Principio]: SSOT
export const STUDENT_VISIBLE_STATUSES: ReadonlyArray<ReviewStatus> =
  Object.freeze([ReviewStatus.APPROVED]);

// [publishSteps · 2026-10-24]: transiciones que llevan un recurso a «publicado» (o de vuelta a borrador al despublicar) SIN saltos — la máquina de estados exige pasar por revisión
// [Patrón]: Lookup Table derivada de TRANSITIONS | [Principio]: SSOT (antes el frontend tenía su propia copia) + idempotencia (ya publicado → [] → reintentar no repite nada) | [Paradigma]: Funcional (pura)
const PUBLISH_PATH: Readonly<
  Record<ReviewStatus, ReadonlyArray<ReviewStatus>>
> = Object.freeze({
  [ReviewStatus.DRAFT]: [
    ReviewStatus.REVIEW_REQUIRED,
    ReviewStatus.REVIEWED,
    ReviewStatus.APPROVED,
  ],
  [ReviewStatus.GENERATED]: [
    ReviewStatus.REVIEW_REQUIRED,
    ReviewStatus.REVIEWED,
    ReviewStatus.APPROVED,
  ],
  [ReviewStatus.REVIEW_REQUIRED]: [
    ReviewStatus.REVIEWED,
    ReviewStatus.APPROVED,
  ],
  [ReviewStatus.REVIEWED]: [ReviewStatus.APPROVED],
  [ReviewStatus.ARCHIVED]: [
    ReviewStatus.DRAFT,
    ReviewStatus.REVIEW_REQUIRED,
    ReviewStatus.REVIEWED,
    ReviewStatus.APPROVED,
  ],
  [ReviewStatus.APPROVED]: [], // Ya publicado: nada que hacer
});

// `publish ? … : …` (operador ternario): despublicar solo afecta a lo publicado (approved → draft); el resto queda igual
export const publishSteps = (
  from: ReviewStatus,
  publish: boolean,
): ReadonlyArray<ReviewStatus> =>
  publish
    ? PUBLISH_PATH[from]
    : from === ReviewStatus.APPROVED
      ? [ReviewStatus.DRAFT]
      : [];

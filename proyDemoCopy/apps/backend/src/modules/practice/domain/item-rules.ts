import type { ItemType } from './item-type';
import type { PracticeItem } from './entities/practice-item.entity';
// [Reglas de ítem · Sprint 8.12]: coherencia del ítem según su tipo y vista para el estudiante sin respuestas | [Patrón]: Specification (funciones puras) | [Principio]: Fail Fast + mínimo privilegio + SRP | [Paradigma]: Funcional

export interface ItemShape {
  itemType: ItemType;
  prompt: string;
  options: string[];
  accepted: string[][];
}

// [itemProblem]: null = válido · texto = por qué no (lo muestra el constructor del docente)
export function itemProblem(i: ItemShape): string | null {
  if (!i.accepted.length || i.accepted.some((a) => !a.length))
    return 'Cada respuesta necesita al menos una variante aceptada';
  switch (i.itemType) {
    case 'multiple_choice':
      return i.options.length < 2
        ? 'Opción múltiple necesita al menos dos opciones'
        : i.accepted.flat().every((a) => i.options.includes(a))
          ? null
          : 'La respuesta correcta debe ser una de las opciones';
    case 'drag_order':
      return i.accepted.every(
        (order) =>
          [...order].sort().join('|') === [...i.options].sort().join('|'),
      )
        ? null
        : 'Cada orden aceptado debe usar exactamente las mismas fichas';
    case 'match_pairs':
      return i.options.length >= 2
        ? null
        : 'Emparejar necesita al menos dos opciones a la derecha';
    case 'mark_errors': {
      const words = i.prompt.split(/\s+/).filter(Boolean).length;
      return i.accepted[0].every((x) => /^\d+$/.test(x) && Number(x) < words)
        ? null
        : 'Los errores deben ser índices de palabra del texto';
    }
    default:
      return null; // fill_blank y open_answer: cualquier texto aceptado
  }
}

// [toStudentItem]: lo que ve el estudiante (sin accepted, correcciones, explicación ni consejo antes de responder)
export const toStudentItem = (i: PracticeItem) => ({
  id: i.id,
  position: i.position,
  itemType: i.itemType,
  skill: i.skill,
  prompt: i.prompt,
  options: i.options,
  blanks:
    i.itemType === 'fill_blank' || i.itemType === 'match_pairs'
      ? i.accepted.length
      : undefined,
});

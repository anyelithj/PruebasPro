// ═══════════════════════════════════════════════════════════════════════════════════════
// workflow.ts — lógica del FLUJO DE TRABAJO (qué estados tiene un proceso y por cuáles puede pasar).
// Patrón: STATE (máquina de estados): el comportamiento depende del estado actual (solo se puede avanzar o retroceder uno).
// Arquitectura: capa de DOMINIO. Son funciones PURAS (paradigma funcional): mismas entradas → mismo resultado,
// sin tocar React, Redux ni Firebase → por eso son fáciles de probar (ver __tests__/services.test.ts).
// ═══════════════════════════════════════════════════════════════════════════════════════

// `import type`: solo tipos (se borran al compilar).
import type { Process, Workflow } from '../models'

// Flujo por defecto: vive en el código (no en la base de datos). `: Workflow` verifica que cumpla la interfaz.
export const DEFAULT_WORKFLOW: Workflow = {
  id: 'default',
  name: 'Flujo estándar',
  // El ÚLTIMO estado es el estado final.
  states: ['Borrador', 'En revisión', 'Aprobado', 'En ejecución', 'Finalizado'],
}

/** Máquina de estados lineal: se puede avanzar al siguiente estado o retroceder al anterior. */
// `export const x = (...) => ...`: función flecha exportada. `: string[]` es el tipo del resultado.
export const nextStates = (workflow: Workflow, current: string): string[] => {
  // `indexOf`: posición del estado actual (o -1 si no existe).
  const i = workflow.states.indexOf(current)
  // `if`: condición. Si el estado no existe en el flujo, solo se ofrece el primero. `slice(0, 1)`: copia el primer elemento.
  if (i === -1) return workflow.states.slice(0, 1)
  // Candidatos: el anterior (i - 1) y el siguiente (i + 1). `filter` descarta los que no existen (undefined en los extremos).
  // `(s): s is string`: «type guard» de TypeScript: le dice al compilador que lo que queda es `string`, nunca undefined.
  return [workflow.states[i - 1], workflow.states[i + 1]].filter((s): s is string => Boolean(s))
}

// ¿Se permite pasar de `from` a `to`? Solo si `to` es vecino directo. `includes`: ¿está en la lista?
export const canTransition = (workflow: Workflow, from: string, to: string): boolean =>
  nextStates(workflow, from).includes(to)

// Estado con el que nace un proceso: el primero del flujo.
export const initialState = (workflow: Workflow): string => workflow.states[0]

// ¿El estado dado es el último (final)? `length - 1`: índice del último elemento.
export const isFinalState = (workflow: Workflow, status: string): boolean =>
  workflow.states[workflow.states.length - 1] === status

// Un proceso está terminado si tiene fecha de cierre (`finishedAt > 0`) O está en el estado final. `||` = «o» lógico.
export const isProcessFinished = (p: Process, workflow: Workflow): boolean =>
  p.finishedAt > 0 || isFinalState(workflow, p.status)

/** Avance dentro del flujo, de 0 a 100. */
export const workflowProgress = (workflow: Workflow, status: string): number => {
  // Posición del estado actual dentro del flujo.
  const i = workflow.states.indexOf(status)
  // Estado desconocido → 0 %.
  if (i < 0) return 0
  // Regla de tres: posición / (total - 1) × 100, redondeado. Si solo hay un estado, ya está al 100 %.
  return workflow.states.length <= 1 ? 100 : Math.round((i / (workflow.states.length - 1)) * 100)
}

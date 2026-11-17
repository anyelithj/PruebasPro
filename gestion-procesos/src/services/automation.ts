// ═══════════════════════════════════════════════════════════════════════════════════════
// automation.ts — AUTOMATIZACIONES «cuando pase X, haz Y».
// Patrón: STRATEGY — cada tipo de acción (notificar, asignar, prioridad, crear tarea) es una función intercambiable
// guardada en el objeto `handlers`. Para añadir una acción nueva basta con registrarla ahí (principio Abierto/Cerrado de SOLID:
// se extiende sin modificar el resto).
// Paradigma basado en EVENTOS: se dispara cuando alguien crea o mueve una tarea o un proceso.
// Límite: corre en el NAVEGADOR de quien dispara el evento (no hay servidor); para correr sin nadie conectado haría falta Cloud Functions.
// ═══════════════════════════════════════════════════════════════════════════════════════

// Funciones de Firestore para consultar las reglas activas (`where('enabled','==',true)` filtra).
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase/firebaseConfig'
import type { ActionType, AutomationRule, Priority, Process, Task, TaskStatus } from '../models'
import { create, patch } from './firestoreService'
import { logHistory, SYSTEM_ACTOR } from './history'
import { notify } from './notifications'

// Tipo UNIÓN DISCRIMINADA: cada variante tiene un campo `type` distinto. TypeScript «estrecha» el tipo al comprobar `event.type`.
export type AutomationEvent =
  | { type: 'task_created'; task: Task }
  | { type: 'task_status'; task: Task; to: TaskStatus }
  | { type: 'process_created'; process: Process }
  | { type: 'process_status'; process: Process; to: string }

// ¿La regla corresponde a este evento? Devuelve true/false.
const matches = (rule: AutomationRule, event: AutomationEvent): boolean => {
  // Si el tipo de disparador no coincide, no aplica.
  if (rule.trigger.type !== event.type) return false
  // En «creado» no hay valor que comparar: aplica siempre. `||` = «o».
  if (event.type === 'process_created' || event.type === 'task_created') return true
  // En «cambió de estado»: sin valor aplica a cualquier estado; con valor, debe ser el estado al que se movió.
  return !rule.trigger.value || rule.trigger.value === event.to
}

// Normaliza el evento a una forma común (qué elemento es, su colección, a quién avisar, a dónde enlazar).
// `as const`: fija el texto como literal ('task' en vez de string) para que TypeScript lo distinga.
const entityOf = (event: AutomationEvent) =>
  event.type === 'task_status' || event.type === 'task_created'
    ? {
        kind: 'task' as const,
        collection: 'tasks',
        id: event.task.id,
        title: event.task.title,
        // `||`: usa el responsable; si no hay, quien la creó.
        target: event.task.assigneeId || event.task.createdBy,
        // Plantilla de texto (backticks) con `${...}` para insertar valores.
        link: `/app/tareas/${event.task.id}`,
        processId: event.task.processId,
      }
    : {
        kind: 'process' as const,
        collection: 'processes',
        id: event.process.id,
        title: event.process.title,
        target: event.process.assigneeIds[0] || event.process.ownerId,
        link: `/app/procesos/${event.process.id}`,
        processId: event.process.id,
      }

// Tipo de una función-acción: recibe la regla y el evento y devuelve una Promesa.
type Handler = (rule: AutomationRule, event: AutomationEvent) => Promise<void>

/** Strategy: cada tipo de acción es una función intercambiable. Para añadir una acción basta con registrarla aquí. */
// `Record<ActionType, Handler>`: TypeScript EXIGE una función por cada tipo de acción (si agregas un tipo y olvidas la función, no compila).
const handlers: Record<ActionType, Handler> = {
  // Acción «notificar»: crea un aviso para la persona indicada (o para el responsable del elemento).
  notify: async (rule, event) => {
    const e = entityOf(event)
    const target = rule.action.value || e.target
    // `await`: espera a que se guarde la notificación.
    if (target) await notify(target, `Automatización «${rule.name}»: ${e.title}`, e.link)
  },
  // Acción «asignar»: cambia el responsable.
  assign: async (rule, event) => {
    const e = entityOf(event)
    if (!rule.action.value) return
    if (e.kind === 'task') await patch('tasks', e.id, { assigneeId: rule.action.value, updatedAt: Date.now() })
    else await patch('processes', e.id, { assigneeIds: [rule.action.value], updatedAt: Date.now() })
  },
  // Acción «cambiar prioridad».
  set_priority: async (rule, event) => {
    const e = entityOf(event)
    await patch(e.collection, e.id, { priority: rule.action.value as Priority, updatedAt: Date.now() })
  },
  // Acción «crear tarea de seguimiento».
  create_task: async (rule, event) => {
    const e = entityOf(event)
    // `Date.now()`: milisegundos desde 1970 (así se guardan las fechas con hora).
    const now = Date.now()
    await create('tasks', {
      title: rule.action.value || `Tarea de «${e.title}»`,
      description: `Creada por la automatización «${rule.name}».`,
      processId: e.processId,
      priority: 'medium',
      status: 'todo',
      assigneeId: '',
      dueDate: '',
      completedAt: 0,
      // 'system' identifica que la creó una automatización (las reglas de Firestore lo permiten en el historial).
      createdBy: SYSTEM_ACTOR.uid,
      createdAt: now,
      updatedAt: now,
    })
  },
}

/** Ejecuta en el navegador las reglas activas que coincidan con el evento. Un error nunca debe romper la acción original. */
export async function runAutomations(event: AutomationEvent): Promise<void> {
  // `try/catch`: manejo de errores. Si algo falla dentro de `try`, salta a `catch` y la acción original sigue funcionando.
  try {
    // Lee una sola vez las reglas activas.
    const snap = await getDocs(query(collection(db, 'automations'), where('enabled', '==', true)))
    const rules = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as unknown as AutomationRule)
    // `Promise.all`: ejecuta todas las reglas en paralelo y espera a que terminen. `filter` deja solo las que coinciden;
    // `map` ejecuta la acción de cada una (aquí actúa el patrón Strategy: `handlers[tipo]` elige la función).
    await Promise.all(
      rules
        .filter((r) => matches(r, event))
        .map(async (r) => {
          await handlers[r.action.type](r, event)
          const e = entityOf(event)
          // Deja constancia en el historial de que la ejecutó el sistema.
          await logHistory(
            {
              entityType: e.kind,
              entityId: e.id,
              entityTitle: e.title,
              action: 'automation',
              summary: `Se ejecutó la regla «${r.name}»`,
            },
            SYSTEM_ACTOR,
          )
        }),
    )
  } catch (error) {
    // Solo se registra en consola: una automatización fallida no debe impedir guardar la tarea o el proceso.
    console.error('Automatización no ejecutada', error)
  }
}

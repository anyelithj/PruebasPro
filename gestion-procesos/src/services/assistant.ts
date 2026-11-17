import type { Process, Task, UserProfile, Workflow } from '../models'
import { PRIORITY_LABEL } from '../models'
import { normalize } from './ai'
import { addDaysIso, todayIso } from './dates'
import { computeIndicators } from './indicators'
import { isProcessFinished } from './workflow'

export interface AssistantContext {
  processes: Process[]
  tasks: Task[]
  users: (UserProfile & { id: string })[]
  workflows: Workflow[]
  uid: string
  now?: number
}
export interface Answer {
  text: string
  links: { label: string; to: string }[]
}

const list = (items: string[], max = 5) =>
  items
    .slice(0, max)
    .map((i) => `• ${i}`)
    .join('\n') + (items.length > max ? `\n… y ${items.length - max} más.` : '')

type Intent = { name: string; test: RegExp; handle: (c: AssistantContext) => Answer }

/** Strategy: cada intención es una función independiente; añadir una pregunta nueva es añadir un elemento. */
const INTENTS: Intent[] = [
  {
    name: 'vencidos',
    test: /(vencid|atrasad|retrasad)/,
    handle: (c) => {
      const today = todayIso(c.now)
      const wf = (id: string) => c.workflows.find((w) => w.id === id) ?? c.workflows[0]
      const ps = c.processes.filter((p) => p.dueDate && p.dueDate < today && !isProcessFinished(p, wf(p.workflowId)))
      const ts = c.tasks.filter((t) => t.dueDate && t.dueDate < today && t.status !== 'done')
      if (!ps.length && !ts.length) return { text: 'No hay procesos ni tareas vencidos. 👍', links: [] }
      return {
        text: `Hay ${ps.length} proceso(s) y ${ts.length} tarea(s) vencidos.\n${list([...ps.map((p) => `Proceso: ${p.title} (${p.dueDate})`), ...ts.map((t) => `Tarea: ${t.title} (${t.dueDate})`)])}`,
        links: [
          { label: 'Ver procesos vencidos', to: '/app/procesos/buscar?vencidos=1' },
          { label: 'Ver calendario', to: '/app/calendario' },
        ],
      }
    },
  },
  {
    name: 'mis-tareas',
    test: /(mis tareas|mis pendientes|que tengo|por hacer)/,
    handle: (c) => {
      const mine = c.tasks.filter((t) => t.assigneeId === c.uid && t.status !== 'done')
      if (!mine.length) return { text: 'No tienes tareas pendientes.', links: [] }
      return {
        text: `Tienes ${mine.length} tarea(s) pendiente(s):\n${list(mine.map((t) => `${t.title}${t.dueDate ? ` — vence ${t.dueDate}` : ''}`))}`,
        links: [{ label: 'Abrir mis tareas', to: '/app/tareas?mias=1' }],
      }
    },
  },
  {
    name: 'urgentes',
    test: /(urgent|prioridad alta|importantes)/,
    handle: (c) => {
      const wf = (id: string) => c.workflows.find((w) => w.id === id) ?? c.workflows[0]
      const ps = c.processes.filter(
        (p) => (p.priority === 'urgent' || p.priority === 'high') && !isProcessFinished(p, wf(p.workflowId)),
      )
      return ps.length
        ? {
            text: `Procesos abiertos de prioridad alta o urgente (${ps.length}):\n${list(ps.map((p) => `${p.title} — ${PRIORITY_LABEL[p.priority]} (${p.status})`))}`,
            links: [{ label: 'Buscar por prioridad', to: '/app/procesos/buscar' }],
          }
        : { text: 'No hay procesos abiertos con prioridad alta o urgente.', links: [] }
    },
  },
  {
    name: 'sin-asignar',
    test: /(sin asignar|sin responsable|sin dueno)/,
    handle: (c) => {
      const ps = c.processes.filter((p) => p.assigneeIds.length === 0)
      const ts = c.tasks.filter((t) => !t.assigneeId && t.status !== 'done')
      return {
        text: `Sin responsable: ${ps.length} proceso(s) y ${ts.length} tarea(s).\n${list([...ps.map((p) => `Proceso: ${p.title}`), ...ts.map((t) => `Tarea: ${t.title}`)])}`,
        links: [],
      }
    },
  },
  {
    name: 'proximos',
    test: /(proxim|esta semana|vencen|por vencer)/,
    handle: (c) => {
      const today = todayIso(c.now)
      const limit = addDaysIso(today, 7)
      const ps = c.processes.filter((p) => p.dueDate >= today && p.dueDate <= limit)
      const ts = c.tasks.filter((t) => t.status !== 'done' && t.dueDate >= today && t.dueDate <= limit)
      return {
        text: `En los próximos 7 días vencen ${ps.length} proceso(s) y ${ts.length} tarea(s).\n${list([...ps.map((p) => `Proceso: ${p.title} (${p.dueDate})`), ...ts.map((t) => `Tarea: ${t.title} (${t.dueDate})`)])}`,
        links: [{ label: 'Abrir agenda', to: '/app/calendario' }],
      }
    },
  },
  {
    name: 'resumen',
    test: /(resumen|estado general|como vamos|indicadores)/,
    handle: (c) => {
      const i = computeIndicators({
        processes: c.processes,
        tasks: c.tasks,
        workflows: c.workflows,
        users: c.users.map((u) => ({ uid: u.uid, name: u.displayName || u.email || '' })),
        now: c.now,
      })
      return {
        text:
          `Procesos: ${i.totalProcesses} (${i.activeProcesses} activos, ${i.finishedProcesses} finalizados, ${i.overdueProcesses} vencidos).\nTareas: ${i.totalTasks} (${i.taskCompletionRate}% completadas, ${i.overdueTasks} vencidas).` +
          (i.onTimeRate !== null ? `\nCumplimiento de fechas límite: ${i.onTimeRate}%.` : '') +
          (i.avgCycleDays !== null ? `\nTiempo promedio de cierre: ${i.avgCycleDays} días.` : ''),
        links: [{ label: 'Ver indicadores', to: '/app/dashboard' }],
      }
    },
  },
]

export const SUGGESTED_QUESTIONS = [
  '¿Qué está vencido?',
  '¿Cuáles son mis tareas?',
  'Dame un resumen',
  '¿Qué vence esta semana?',
  '¿Qué hay urgente?',
  '¿Qué está sin asignar?',
]

export function ask(question: string, context: AssistantContext): Answer {
  const q = normalize(question)
  const intent = INTENTS.find((i) => i.test.test(q))
  return intent
    ? intent.handle(context)
    : {
        text: 'No entendí la pregunta. Puedo ayudarte con: vencidos, tus tareas, urgentes, sin asignar, lo que vence esta semana o un resumen general.',
        links: [],
      }
}

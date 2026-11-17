import { PRIORITY_LABEL, TASK_STATUS_LABEL, type Process, type Task, type Workflow } from '../models'
import { todayIso } from './dates'
import { isProcessFinished, workflowProgress } from './workflow'

export interface ReportTable {
  title: string
  columns: string[]
  rows: string[][]
}
export type ReportKind = 'procesos' | 'tareas' | 'cumplimiento'
export const REPORT_LABEL: Record<ReportKind, string> = {
  procesos: 'Procesos y avance en el flujo',
  tareas: 'Tareas',
  cumplimiento: 'Cumplimiento por responsable',
}

interface Input {
  processes: Process[]
  tasks: Task[]
  workflows: Workflow[]
  nameOf: (uid: string) => string
  from?: string
  to?: string
  now?: number
}

const inRange = (ms: number, from?: string, to?: string) =>
  (!from || todayIso(ms) >= from) && (!to || todayIso(ms) <= to)
const date = (ms: number) => (ms ? todayIso(ms) : '—')

export function buildReport(kind: ReportKind, input: Input): ReportTable {
  const { workflows, nameOf, from, to, now } = input
  const today = todayIso(now)
  const wf = (id: string) => workflows.find((w) => w.id === id) ?? workflows[0]
  const processes = input.processes.filter((p) => inRange(p.createdAt, from, to))
  const tasks = input.tasks.filter((t) => inRange(t.createdAt, from, to))

  if (kind === 'procesos') {
    return {
      title: REPORT_LABEL.procesos,
      columns: [
        'Título',
        'Flujo',
        'Estado',
        'Avance del flujo',
        'Prioridad',
        'Responsables',
        'Vence',
        'Finalizado',
        'Situación',
      ],
      rows: processes.map((p) => {
        const w = wf(p.workflowId)
        const finished = isProcessFinished(p, w)
        const situation = finished
          ? p.dueDate && todayIso(p.finishedAt || p.updatedAt) > p.dueDate
            ? 'Finalizado tarde'
            : 'Finalizado a tiempo'
          : p.dueDate && p.dueDate < today
            ? 'Vencido'
            : 'En curso'
        return [
          p.title,
          w.name,
          p.status,
          `${finished ? 100 : workflowProgress(w, p.status)}%`,
          PRIORITY_LABEL[p.priority],
          p.assigneeIds.map(nameOf).join(', ') || 'Sin asignar',
          p.dueDate || '—',
          finished ? date(p.finishedAt || p.updatedAt) : '—',
          situation,
        ]
      }),
    }
  }
  if (kind === 'tareas') {
    const title = (id: string) => input.processes.find((p) => p.id === id)?.title ?? '—'
    return {
      title: REPORT_LABEL.tareas,
      columns: ['Tarea', 'Proceso', 'Estado', 'Prioridad', 'Responsable', 'Vence', 'Completada', 'Situación'],
      rows: tasks.map((t) => [
        t.title,
        title(t.processId),
        TASK_STATUS_LABEL[t.status],
        PRIORITY_LABEL[t.priority],
        nameOf(t.assigneeId),
        t.dueDate || '—',
        date(t.completedAt),
        t.status === 'done' ? 'Hecha' : t.dueDate && t.dueDate < today ? 'Vencida' : 'Pendiente',
      ]),
    }
  }
  const uids = [...new Set([...processes.flatMap((p) => p.assigneeIds), ...tasks.map((t) => t.assigneeId)])].filter(
    Boolean,
  )
  return {
    title: REPORT_LABEL.cumplimiento,
    columns: [
      'Responsable',
      'Procesos asignados',
      'Finalizados a tiempo',
      'Finalizados tarde',
      'Vencidos',
      'Tareas hechas',
      'Tareas pendientes',
      'Tareas vencidas',
    ],
    rows: uids.map((uid) => {
      const ps = processes.filter((p) => p.assigneeIds.includes(uid))
      const fin = ps.filter((p) => isProcessFinished(p, wf(p.workflowId)))
      const late = fin.filter((p) => p.dueDate && todayIso(p.finishedAt || p.updatedAt) > p.dueDate).length
      const ts = tasks.filter((t) => t.assigneeId === uid)
      return [
        nameOf(uid),
        String(ps.length),
        String(fin.length - late),
        String(late),
        String(ps.filter((p) => !isProcessFinished(p, wf(p.workflowId)) && p.dueDate && p.dueDate < today).length),
        String(ts.filter((t) => t.status === 'done').length),
        String(ts.filter((t) => t.status !== 'done').length),
        String(ts.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < today).length),
      ]
    }),
  }
}

const cell = (v: string) => `"${v.replace(/"/g, '""')}"`
export const reportToCsv = (r: ReportTable): string =>
  '\ufeff' + [r.columns, ...r.rows].map((row) => row.map(cell).join(',')).join('\n')

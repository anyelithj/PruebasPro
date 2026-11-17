import type { Process, Task, Workflow } from '../models'
import { addDaysIso, todayIso } from './dates'
import { isProcessFinished } from './workflow'

export interface AlertItem {
  key: string
  kind: 'overdue' | 'soon'
  type: 'proceso' | 'tarea'
  title: string
  dueDate: string
  link: string
}

interface Input {
  processes: Process[]
  tasks: Task[]
  workflows: Workflow[]
  uid: string
  dueSoonDays: number
  now?: number
}

/** Alertas derivadas (no se guardan): vencidos y próximos a vencer de los que soy responsable. */
export function computeAlerts({ processes, tasks, workflows, uid, dueSoonDays, now = Date.now() }: Input): AlertItem[] {
  const today = todayIso(now)
  const limit = addDaysIso(today, dueSoonDays)
  const wf = (id: string) => workflows.find((w) => w.id === id) ?? workflows[0]
  const classify = (due: string): AlertItem['kind'] | null =>
    !due ? null : due < today ? 'overdue' : due <= limit ? 'soon' : null

  const items: AlertItem[] = []
  processes.forEach((p) => {
    const mine = p.ownerId === uid || p.assigneeIds.includes(uid)
    const kind = classify(p.dueDate)
    if (mine && kind && !isProcessFinished(p, wf(p.workflowId)))
      items.push({
        key: `p-${p.id}`,
        kind,
        type: 'proceso',
        title: p.title,
        dueDate: p.dueDate,
        link: `/app/procesos/${p.id}`,
      })
  })
  tasks.forEach((t) => {
    const kind = classify(t.dueDate)
    if (t.assigneeId === uid && kind && t.status !== 'done')
      items.push({
        key: `t-${t.id}`,
        kind,
        type: 'tarea',
        title: t.title,
        dueDate: t.dueDate,
        link: `/app/tareas/${t.id}`,
      })
  })
  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

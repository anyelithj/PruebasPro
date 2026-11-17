import { PRIORITIES, type Priority, type Process, type Task, type Workflow } from '../models'
import { DAY_MS, toIso, todayIso } from './dates'
import { isProcessFinished } from './workflow'

/**
 * Analítica: métricas de comportamiento en el tiempo (ritmo, antigüedad, plazos, cumplimiento por persona).
 * Complementa a `computeIndicators` (estado actual) sin repetir sus cifras.
 */
export interface Analytics {
  /** Tareas creadas vs. completadas por semana (últimas 8). */
  weekly: { label: string; created: number; finished: number }[]
  /** Procesos abiertos según cuántos días llevan abiertos. */
  aging: { label: string; value: number }[]
  /** Trabajo abierto (procesos + tareas) que vence pronto, sin contar lo ya vencido. */
  upcoming: { label: string; value: number }[]
  /** Días promedio de cierre por prioridad (solo prioridades con procesos cerrados). */
  cycleByPriority: { priority: Priority; days: number }[]
  /** Procesos por categoría (6 principales + «Otras»). */
  byCategory: { label: string; value: number }[]
  /** Procesos frente a solicitudes. */
  byKind: { label: string; value: number }[]
  /** Tareas completadas según el día de la semana. */
  byWeekday: { label: string; value: number }[]
  /** % de tareas completadas a tiempo por persona (solo tareas con fecha). */
  onTimeByPerson: { name: string; pct: number; total: number }[]
  insights: {
    avgWeeklyDone: number
    bestWeekday: string | null
    slowestPriority: { priority: Priority; days: number } | null
    topPerson: { name: string; pct: number } | null
  }
}

interface Input {
  processes: Process[]
  tasks: Task[]
  workflows: Workflow[]
  users: { uid: string; name: string }[]
  now?: number
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const bucket = <T>(items: T[], edges: { label: string; test: (x: T) => boolean }[]) =>
  edges.map((e) => ({ label: e.label, value: items.filter(e.test).length }))

export function computeAnalytics({ processes, tasks, workflows, users, now = Date.now() }: Input): Analytics {
  const today = todayIso(now)
  const wf = (id: string) => workflows.find((w) => w.id === id) ?? workflows[0]
  const finished = (p: Process) => isProcessFinished(p, wf(p.workflowId))
  const open = processes.filter((p) => !finished(p))
  const closed = processes.filter(finished)
  const done = tasks.filter((t) => t.status === 'done' && t.completedAt)

  // Semanas de lunes a domingo, la última es la actual.
  const d = new Date(now)
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)).getTime()
  const weekly = Array.from({ length: 8 }, (_, i) => {
    const start = monday - (7 - i) * 7 * DAY_MS
    const inWeek = (ms: number) => ms >= start && ms < start + 7 * DAY_MS
    const s = new Date(start)
    return {
      label: `${s.getDate()}/${s.getMonth() + 1}`,
      created: tasks.filter((t) => inWeek(t.createdAt)).length,
      finished: done.filter((t) => inWeek(t.completedAt)).length,
    }
  })

  const ageDays = (p: Process) => (now - p.createdAt) / DAY_MS
  const aging = bucket(open, [
    { label: '0–7 días', test: (p) => ageDays(p) <= 7 },
    { label: '8–30 días', test: (p) => ageDays(p) > 7 && ageDays(p) <= 30 },
    { label: '31–90 días', test: (p) => ageDays(p) > 30 && ageDays(p) <= 90 },
    { label: 'Más de 90 días', test: (p) => ageDays(p) > 90 },
  ])

  const in7 = toIso(new Date(now + 7 * DAY_MS))
  const in30 = toIso(new Date(now + 30 * DAY_MS))
  const dues = [...open.map((p) => p.dueDate), ...tasks.filter((t) => t.status !== 'done').map((t) => t.dueDate)]
  const upcoming = bucket(dues, [
    { label: 'Próximos 7 días', test: (x) => !!x && x >= today && x <= in7 },
    { label: '8–30 días', test: (x) => !!x && x > in7 && x <= in30 },
    { label: 'Más de 30 días', test: (x) => !!x && x > in30 },
    { label: 'Sin fecha', test: (x) => !x },
  ])

  const cycleByPriority = [...PRIORITIES]
    .reverse()
    .map((priority) => {
      const own = closed.filter((p) => p.priority === priority)
      const total = own.reduce((a, p) => a + ((p.finishedAt || p.updatedAt) - p.createdAt) / DAY_MS, 0)
      return { priority, days: own.length ? Math.round((total / own.length) * 10) / 10 : -1 }
    })
    .filter((x) => x.days >= 0)

  const cats = new Map<string, number>()
  processes.forEach((p) => {
    const k = p.category.trim() || 'Sin categoría'
    cats.set(k, (cats.get(k) ?? 0) + 1)
  })
  const sortedCats = [...cats].sort((a, b) => b[1] - a[1])
  const byCategory = sortedCats.slice(0, 6).map(([label, value]) => ({ label, value }))
  const rest = sortedCats.slice(6).reduce((a, [, v]) => a + v, 0)
  if (rest) byCategory.push({ label: 'Otras', value: rest })

  const byKind = [
    { label: 'Procesos', value: processes.filter((p) => p.kind !== 'solicitud').length },
    { label: 'Solicitudes', value: processes.filter((p) => p.kind === 'solicitud').length },
  ]

  const byWeekday = WEEKDAYS.map((label, i) => ({
    label,
    value: done.filter((t) => (new Date(t.completedAt).getDay() + 6) % 7 === i).length,
  }))

  const onTimeByPerson = users
    .map((u) => {
      const own = done.filter((t) => t.assigneeId === u.uid && t.dueDate)
      const ok = own.filter((t) => todayIso(t.completedAt) <= t.dueDate).length
      return { name: u.name, pct: own.length ? Math.round((ok / own.length) * 100) : 0, total: own.length }
    })
    .filter((x) => x.total > 0)
    .sort((a, b) => b.pct - a.pct || b.total - a.total)

  const best = byWeekday.reduce((a, b) => (b.value > a.value ? b : a), byWeekday[0])
  const slowest = cycleByPriority.reduce<Analytics['insights']['slowestPriority']>(
    (a, b) => (!a || b.days > a.days ? b : a),
    null,
  )

  return {
    weekly,
    aging,
    upcoming,
    cycleByPriority,
    byCategory,
    byKind,
    byWeekday,
    onTimeByPerson,
    insights: {
      avgWeeklyDone: Math.round((weekly.reduce((a, w) => a + w.finished, 0) / weekly.length) * 10) / 10,
      bestWeekday: best.value ? best.label : null,
      slowestPriority: slowest,
      topPerson: onTimeByPerson[0] ? { name: onTimeByPerson[0].name, pct: onTimeByPerson[0].pct } : null,
    },
  }
}

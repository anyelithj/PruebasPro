import { useCallback, useMemo, useState } from 'react'
import { useAuth } from './useAuth'
import { useProcesses } from './useProcesses'
import { useTasks } from './useTasks'
import { addDaysIso, toIso, todayIso } from '../services/dates'

export interface CalendarItem {
  key: string
  type: 'proceso' | 'tarea'
  /** «vence» en la fecha límite, «inicio» en la fecha de inicio de un proceso. */
  kind: 'vence' | 'inicio'
  title: string
  date: string
  link: string
  done: boolean
  overdue: boolean
}
export interface CalendarDay {
  date: string
  day: number
  inMonth: boolean
  isToday: boolean
  items: CalendarItem[]
}
export interface CalendarFilters {
  type: 'all' | 'proceso' | 'tarea'
  onlyMine: boolean
}

/** Agenda que reúne las fechas de procesos y tareas. */
export function useCalendar() {
  const { user } = useAuth()
  const { processes, isFinished } = useProcesses()
  const { tasks } = useTasks()
  const [cursor, setCursor] = useState(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  })
  const [filters, setFilters] = useState<CalendarFilters>({ type: 'all', onlyMine: false })

  const items = useMemo(() => {
    const today = todayIso()
    const uid = user?.uid
    const list: CalendarItem[] = []
    if (filters.type !== 'tarea') {
      processes
        .filter((p) => !filters.onlyMine || p.ownerId === uid || p.assigneeIds.includes(uid ?? ''))
        .forEach((p) => {
          const done = isFinished(p)
          const link = `/app/procesos/${p.id}`
          if (p.dueDate)
            list.push({
              key: `p-${p.id}-v`,
              type: 'proceso',
              kind: 'vence',
              title: p.title,
              date: p.dueDate,
              link,
              done,
              overdue: !done && p.dueDate < today,
            })
          if (p.startDate && p.startDate !== p.dueDate)
            list.push({
              key: `p-${p.id}-i`,
              type: 'proceso',
              kind: 'inicio',
              title: p.title,
              date: p.startDate,
              link,
              done,
              overdue: false,
            })
        })
    }
    if (filters.type !== 'proceso') {
      tasks
        .filter((t) => !filters.onlyMine || t.assigneeId === uid)
        .forEach((t) => {
          if (t.dueDate)
            list.push({
              key: `t-${t.id}`,
              type: 'tarea',
              kind: 'vence',
              title: t.title,
              date: t.dueDate,
              link: `/app/tareas/${t.id}`,
              done: t.status === 'done',
              overdue: t.status !== 'done' && t.dueDate < today,
            })
        })
    }
    return list.sort((a, b) => a.date.localeCompare(b.date))
  }, [processes, tasks, filters, user?.uid, isFinished])

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>()
    items.forEach((i) => map.set(i.date, [...(map.get(i.date) ?? []), i]))
    return map
  }, [items])

  const weeks = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const offset = (first.getDay() + 6) % 7 // la semana inicia en lunes
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset)
    const today = todayIso()
    return Array.from({ length: 6 }, (_, w) =>
      Array.from({ length: 7 }, (_, d): CalendarDay => {
        const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d)
        const key = toIso(date)
        return {
          date: key,
          day: date.getDate(),
          inMonth: date.getMonth() === cursor.getMonth(),
          isToday: key === today,
          items: byDate.get(key) ?? [],
        }
      }),
    )
  }, [cursor, byDate])

  /** Vencidos sin cerrar + lo que viene en los próximos 30 días. */
  const agenda = useMemo(() => {
    const today = todayIso()
    const limit = addDaysIso(today, 30)
    return items.filter((i) => (i.overdue && !i.done) || (i.date >= today && i.date <= limit))
  }, [items])

  const shift = useCallback((n: number) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1)), [])
  const goToday = useCallback(() => {
    const n = new Date()
    setCursor(new Date(n.getFullYear(), n.getMonth(), 1))
  }, [])

  return {
    weeks,
    agenda,
    filters,
    setFilters,
    itemsOn: useCallback((date: string) => byDate.get(date) ?? [], [byDate]),
    monthLabel: cursor.toLocaleDateString('es', { month: 'long', year: 'numeric' }),
    next: () => shift(1),
    prev: () => shift(-1),
    goToday,
  }
}

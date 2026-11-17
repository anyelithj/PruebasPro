import { withProcessDefaults, withTaskDefaults } from '../../models'
import { computeAnalytics } from '../analytics'
import { DAY_MS } from '../dates'
import { DEFAULT_WORKFLOW } from '../workflow'

const now = new Date(2026, 10, 4, 12).getTime() // miércoles 4/11/2026
const final = DEFAULT_WORKFLOW.states[DEFAULT_WORKFLOW.states.length - 1]

describe('analítica', () => {
  it('agrupa antigüedad, plazos, cierre por prioridad y cumplimiento por persona', () => {
    const a = computeAnalytics({
      now,
      workflows: [DEFAULT_WORKFLOW],
      users: [{ uid: 'u1', name: 'Ana' }],
      processes: [
        withProcessDefaults({ id: 'p1', status: 'Borrador', createdAt: now - 3 * DAY_MS, dueDate: '2026-11-06' }),
        withProcessDefaults({ id: 'p2', status: 'Borrador', createdAt: now - 100 * DAY_MS, category: 'TI' }),
        withProcessDefaults({
          id: 'p3',
          status: final,
          priority: 'urgent',
          kind: 'solicitud',
          createdAt: now - 10 * DAY_MS,
          finishedAt: now - 6 * DAY_MS,
        }),
      ],
      tasks: [
        // completada el lunes 2/11, a tiempo
        withTaskDefaults({ id: 't1', status: 'done', assigneeId: 'u1', dueDate: '2026-11-03', createdAt: now - 5 * DAY_MS, completedAt: now - 2 * DAY_MS }),
        // completada tarde
        withTaskDefaults({ id: 't2', status: 'done', assigneeId: 'u1', dueDate: '2026-10-01', createdAt: now - 40 * DAY_MS, completedAt: now - 2 * DAY_MS }),
        withTaskDefaults({ id: 't3', status: 'todo', dueDate: '2026-12-31', createdAt: now }),
      ],
    })

    expect(a.aging.map((x) => x.value)).toEqual([1, 0, 0, 1])
    expect(a.upcoming.map((x) => x.value)).toEqual([1, 0, 1, 1]) // p1 (7 días), t3 (>30), p2 sin fecha
    expect(a.cycleByPriority).toEqual([{ priority: 'urgent', days: 4 }])
    expect(a.byKind).toEqual([
      { label: 'Procesos', value: 2 },
      { label: 'Solicitudes', value: 1 },
    ])
    expect(a.byCategory[0]).toEqual({ label: 'Sin categoría', value: 2 })
    expect(a.byWeekday.find((d) => d.label === 'Lun')?.value).toBe(2)
    expect(a.onTimeByPerson).toEqual([{ name: 'Ana', pct: 50, total: 2 }])
    expect(a.weekly).toHaveLength(8)
    expect(a.weekly[7]).toEqual({ label: '2/11', created: 1, finished: 2 })
    expect(a.insights.bestWeekday).toBe('Lun')
  })
})

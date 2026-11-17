import { useState } from 'react'
import { Badge, Button, ButtonGroup, Form } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useCalendar, type CalendarItem } from '../../hooks/useCalendar'
import { todayIso } from '../../services/dates'
import '../../styles/StyleCalendar.scss'
import PageHeader from '../accesories/PageHeader'
import Seo from '../accesories/Seo'
import { formatDate } from '../helpers/ConvertirId'

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const itemClass = (i: CalendarItem) =>
  `calendar__item calendar__item--${i.type}${i.done ? ' is-done' : ''}${i.overdue ? ' is-overdue' : ''}`
const itemLabel = (i: CalendarItem) =>
  `${i.type === 'proceso' ? 'Proceso' : 'Tarea'} ${i.kind === 'inicio' ? 'inicia' : 'vence'}: ${i.title}${i.done ? ' (completado)' : ''}${i.overdue ? ' (vencido)' : ''}`

/** Agenda de procesos y tareas: vista mensual con panel del día, y vista de lista de próximos. */
export default function CalendarView() {
  const { weeks, agenda, filters, setFilters, itemsOn, monthLabel, next, prev, goToday } = useCalendar()
  const { can } = useAuth()
  const [view, setView] = useState<'mes' | 'agenda'>('mes')
  const [selected, setSelected] = useState(todayIso())
  const dayItems = itemsOn(selected)

  return (
    <>
      <Seo title="Agenda" noIndex />
      <PageHeader
        title="Agenda"
        subtitle="Fechas de inicio y límite de procesos y tareas."
        actions={
          <>
            <ButtonGroup aria-label="Tipo de vista">
              <Button
                variant={view === 'mes' ? 'primary' : 'outline-primary'}
                onClick={() => setView('mes')}
                aria-pressed={view === 'mes'}
              >
                Mes
              </Button>
              <Button
                variant={view === 'agenda' ? 'primary' : 'outline-primary'}
                onClick={() => setView('agenda')}
                aria-pressed={view === 'agenda'}
              >
                Lista
              </Button>
            </ButtonGroup>
            {view === 'mes' && (
              <>
                <Button variant="outline-primary" onClick={prev} aria-label="Mes anterior">
                  ←
                </Button>
                <Button variant="outline-primary" onClick={goToday}>
                  Hoy
                </Button>
                <Button variant="outline-primary" onClick={next} aria-label="Mes siguiente">
                  →
                </Button>
              </>
            )}
          </>
        }
      />

      <Form className="calendar__filters" aria-label="Filtros de la agenda" onSubmit={(e) => e.preventDefault()}>
        <div>
          <Form.Label htmlFor="cal-type" className="me-2 mb-0">
            Mostrar
          </Form.Label>
          <Form.Select
            id="cal-type"
            size="sm"
            className="d-inline-block w-auto"
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value as typeof filters.type })}
          >
            <option value="all">Procesos y tareas</option>
            <option value="proceso">Solo procesos</option>
            <option value="tarea">Solo tareas</option>
          </Form.Select>
        </div>
        <Form.Check
          type="switch"
          id="cal-mine"
          label="Solo lo mío"
          checked={filters.onlyMine}
          onChange={(e) => setFilters({ ...filters, onlyMine: e.target.checked })}
        />
        <span className="calendar__legend">
          <span className="calendar__item calendar__item--proceso">Proceso</span>{' '}
          <span className="calendar__item calendar__item--tarea">Tarea</span>{' '}
          <span className="calendar__item is-overdue">Vencido</span>
        </span>
      </Form>

      {view === 'agenda' ? (
        agenda.length === 0 ? (
          <p className="empty-state">No hay vencidos ni fechas en los próximos 30 días.</p>
        ) : (
          <ul className="row-list">
            {agenda.map((i) => (
              <li key={i.key} className="row-list__item">
                <div>
                  <Link to={i.link} className="fw-bold">
                    {i.title}
                  </Link>
                  <div className="small text-secondary">
                    {i.type === 'proceso' ? 'Proceso' : 'Tarea'} · {i.kind === 'inicio' ? 'Inicia' : 'Vence'}{' '}
                    {formatDate(i.date)}
                  </div>
                </div>
                {i.overdue ? (
                  <Badge bg="danger">Vencido</Badge>
                ) : i.done ? (
                  <Badge bg="success">Completado</Badge>
                ) : null}
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="l-split">
          <div className="calendar__wrap">
            <table className="calendar">
              <caption aria-live="polite" className="calendar__caption">
                {monthLabel}
              </caption>
              <thead>
                <tr>
                  {WEEKDAYS.map((d) => (
                    <th key={d} scope="col">
                      <span className="d-none d-md-inline">{d}</span>
                      <span className="d-md-none" aria-label={d}>
                        {d[0]}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((week) => (
                  <tr key={week[0].date}>
                    {week.map((day) => (
                      <td
                        key={day.date}
                        className={`calendar__cell ${day.inMonth ? '' : 'is-outside'} ${day.isToday ? 'is-today' : ''} ${day.date === selected ? 'is-selected' : ''}`}
                      >
                        <button
                          type="button"
                          className="calendar__day"
                          onClick={() => setSelected(day.date)}
                          aria-pressed={day.date === selected}
                          aria-label={`${formatDate(day.date)}, ${day.items.length} elemento(s)`}
                        >
                          {day.day}
                        </button>
                        <ul className="calendar__items">
                          {day.items.slice(0, 3).map((i) => (
                            <li key={i.key}>
                              <Link to={i.link} className={itemClass(i)}>
                                <span className="visually-hidden">{itemLabel(i)}</span>
                                <span aria-hidden="true">{i.title}</span>
                              </Link>
                            </li>
                          ))}
                          {day.items.length > 3 && (
                            <li className="small text-secondary">+{day.items.length - 3} más</li>
                          )}
                        </ul>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <aside className="day-panel" aria-labelledby="dia-titulo" aria-live="polite">
            <h2 id="dia-titulo" className="h6">
              {formatDate(selected)}
            </h2>
            {dayItems.length === 0 ? (
              <p className="text-secondary small">Nada agendado este día.</p>
            ) : (
              <ul className="list-unstyled">
                {dayItems.map((i) => (
                  <li key={i.key} className="mb-2">
                    <Link to={i.link} className="fw-bold">
                      {i.title}
                    </Link>
                    <div className="small text-secondary">{itemLabel(i).split(':')[0]}</div>
                  </li>
                ))}
              </ul>
            )}
            <div className="d-grid gap-2">
              {can('task:create') && (
                <Link to={`/app/tareas/nueva?fecha=${selected}`} className="btn btn-sm btn-outline-primary">
                  Agendar tarea este día
                </Link>
              )}
              {can('process:create') && (
                <Link to={`/app/procesos/nuevo?fecha=${selected}`} className="btn btn-sm btn-outline-primary">
                  Agendar proceso este día
                </Link>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  )
}

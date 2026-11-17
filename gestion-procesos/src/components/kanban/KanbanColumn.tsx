import { useState, type ReactNode } from 'react'

interface Props {
  id: string
  title: string
  count: number
  onDropItem: (columnId: string) => void
  children: ReactNode
}

/** Columna genérica: sirve para estados de tarea y estados de un workflow. */
export default function KanbanColumn({ id, title, count, onDropItem, children }: Props) {
  const [over, setOver] = useState(false)
  return (
    <section
      className={`kanban__column${over ? ' is-over' : ''}`}
      aria-labelledby={`col-${id}`}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        onDropItem(id)
      }}
    >
      <h2 id={`col-${id}`} className="h6">
        {title} <span className="kanban__count">{count}</span>
      </h2>
      <ul className="kanban__list">{children}</ul>
    </section>
  )
}

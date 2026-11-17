import { Tab, Tabs } from 'react-bootstrap'
import '../../styles/StyleKanban.scss'
import PageHeader from '../accesories/PageHeader'
import Seo from '../accesories/Seo'
import ProcessKanban from './ProcessKanban'
import TaskKanban from './TaskKanban'

/** Contenedor con dos tableros: procesos (por estado del workflow) y tareas (por estado de tarea). */
export default function KanbanBoard() {
  return (
    <>
      <Seo title="Tablero Kanban" noIndex />
      <PageHeader
        title="Tablero Kanban"
        subtitle="Arrastra las tarjetas o usa el selector de cada una para cambiar su estado."
      />
      <Tabs defaultActiveKey="procesos" id="kanban-tabs" className="mb-3" mountOnEnter>
        <Tab eventKey="procesos" title="Procesos">
          <ProcessKanban />
        </Tab>
        <Tab eventKey="tareas" title="Tareas">
          <TaskKanban />
        </Tab>
      </Tabs>
    </>
  )
}

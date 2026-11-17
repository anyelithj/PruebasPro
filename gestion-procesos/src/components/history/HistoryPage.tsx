import PageHeader from '../accesories/PageHeader'
import Seo from '../accesories/Seo'
import HistoryTimeline from './HistoryTimeline'

export default function HistoryPage() {
  return (
    <>
      <Seo title="Historial" noIndex />
      <PageHeader
        title="Historial y seguimiento"
        subtitle="Últimos cambios en procesos, tareas, usuarios, workflows y archivos."
      />
      <div className="detail-block">
        <HistoryTimeline max={200} />
      </div>
    </>
  )
}

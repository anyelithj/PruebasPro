import { useMemo, useState } from 'react'
import { Alert, Button, Col, Dropdown, Form, Row } from 'react-bootstrap'
import { FiDownload, FiPrinter } from 'react-icons/fi'
import { useUserPerfil } from '../../hooks/UserPerfil'
import { useProcesses } from '../../hooks/useProcesses'
import { useTasks } from '../../hooks/useTasks'
import { useUsers } from '../../hooks/useUsers'
import { useWorkflow } from '../../hooks/useWorkflow'
import { buildReport, REPORT_LABEL, type ReportKind } from '../../services/reports'
import { downloadReport, FORMAT_LABEL, type ReportFormat } from '../../services/reportExport'
import PageHeader from '../accesories/PageHeader'
import Seo from '../accesories/Seo'

/** Reportes tabulares con filtro por fecha de creación; se descargan en PDF, Excel, Word o CSV. */
export default function ReportsPage() {
  const { processes } = useProcesses()
  const { tasks } = useTasks()
  const { nameOf } = useUsers()
  const { name } = useUserPerfil()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { workflows } = useWorkflow()
  const [kind, setKind] = useState<ReportKind>('procesos')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const report = useMemo(
    () => buildReport(kind, { processes, tasks, workflows, nameOf, from, to }),
    [kind, processes, tasks, workflows, nameOf, from, to],
  )

  const filters = [from && `creados desde ${from}`, to && `creados hasta ${to}`].filter(Boolean).join(', ')

  const download = async (format: ReportFormat) => {
    setBusy(true)
    setError(null)
    try {
      await downloadReport(format, report, { generatedBy: name, filters })
    } catch (e) {
      console.error(e)
      setError('No se pudo generar el archivo. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Seo title="Reportes" noIndex />
      <PageHeader
        title="Reportes"
        subtitle="Consulta y descarga en PDF, Excel, Word o CSV."
        actions={
          <>
            <Dropdown>
              <Dropdown.Toggle variant="primary" disabled={busy || report.rows.length === 0}>
                <FiDownload aria-hidden="true" /> {busy ? 'Generando…' : 'Descargar'}
              </Dropdown.Toggle>
              <Dropdown.Menu>
                {(Object.keys(FORMAT_LABEL) as ReportFormat[]).map((f) => (
                  <Dropdown.Item key={f} as="button" onClick={() => download(f)}>
                    {FORMAT_LABEL[f]}
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown>
            <Button variant="outline-primary" onClick={() => window.print()}>
              <FiPrinter aria-hidden="true" /> Imprimir
            </Button>
          </>
        }
      />
      <Form
        className="filter-form mb-3 is-print-hidden"
        aria-label="Opciones del reporte"
        onSubmit={(e) => e.preventDefault()}
      >
        <Row className="g-3">
          <Col md={5}>
            <Form.Label htmlFor="rp-kind">Reporte</Form.Label>
            <Form.Select id="rp-kind" value={kind} onChange={(e) => setKind(e.target.value as ReportKind)}>
              {(Object.keys(REPORT_LABEL) as ReportKind[]).map((k) => (
                <option key={k} value={k}>
                  {REPORT_LABEL[k]}
                </option>
              ))}
            </Form.Select>
          </Col>
          <Col sm={6} md={3}>
            <Form.Label htmlFor="rp-from">Creados desde</Form.Label>
            <Form.Control id="rp-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Col>
          <Col sm={6} md={3}>
            <Form.Label htmlFor="rp-to">Creados hasta</Form.Label>
            <Form.Control id="rp-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Col>
        </Row>
      </Form>
      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
      <h2 className="h5 print-title">{report.title}</h2>
      {report.rows.length === 0 ? (
        <p className="empty-state">No hay datos para este reporte.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm table-striped align-middle">
            <caption className="visually-hidden">{report.title}</caption>
            <thead>
              <tr>
                {report.columns.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) =>
                    j === 0 ? (
                      <th scope="row" key={j}>
                        {c}
                      </th>
                    ) : (
                      <td key={j}>{c}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

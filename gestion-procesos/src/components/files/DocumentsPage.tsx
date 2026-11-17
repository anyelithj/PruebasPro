import { useMemo, useState } from 'react'
import { Button, Col, Form, Row } from 'react-bootstrap'
import { FiDownload } from 'react-icons/fi'
import { Link } from 'react-router-dom'
import { useFiles } from '../../hooks/useFiles'
import { normalize } from '../../services/ai'
import { formatBytes } from '../../services/fileStorage'
import PageHeader from '../accesories/PageHeader'
import Seo from '../accesories/Seo'
import { formatDate } from '../helpers/ConvertirId'
import { showError } from '../helpers/confirm'

export default function DocumentsPage() {
  const { files, download } = useFiles()
  const [text, setText] = useState('')
  const [type, setType] = useState('')
  const visible = useMemo(
    () =>
      files.filter(
        (f) =>
          (!type || f.entityType === type) &&
          (!text || normalize(`${f.name} ${f.entityTitle} ${f.uploaderName}`).includes(normalize(text))),
      ),
    [files, text, type],
  )

  return (
    <>
      <Seo title="Documentos" noIndex />
      <PageHeader
        title="Documentos"
        subtitle="Todos los archivos adjuntos a procesos y tareas. Para subir uno, ábrelo desde el detalle del proceso o la tarea."
      />
      <Form
        role="search"
        aria-label="Buscar documentos"
        className="filter-form mb-3"
        onSubmit={(e) => e.preventDefault()}
      >
        <Row className="g-3">
          <Col md={8}>
            <Form.Label htmlFor="doc-text">Buscar</Form.Label>
            <Form.Control
              id="doc-text"
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Nombre del archivo, proceso o persona"
            />
          </Col>
          <Col md={4}>
            <Form.Label htmlFor="doc-type">Adjunto a</Form.Label>
            <Form.Select id="doc-type" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Procesos y tareas</option>
              <option value="process">Procesos</option>
              <option value="task">Tareas</option>
            </Form.Select>
          </Col>
        </Row>
      </Form>
      {visible.length === 0 ? (
        <p className="empty-state">No hay documentos.</p>
      ) : (
        <div className="table-responsive">
          <table className="table align-middle">
            <caption className="visually-hidden">Documentos adjuntos</caption>
            <thead>
              <tr>
                <th scope="col">Archivo</th>
                <th scope="col">Adjunto a</th>
                <th scope="col">Tamaño</th>
                <th scope="col">Subido por</th>
                <th scope="col">Fecha</th>
                <th scope="col">
                  <span className="visually-hidden">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((f) => (
                <tr key={f.id}>
                  <td>{f.name}</td>
                  <td>
                    <Link to={f.entityType === 'process' ? `/app/procesos/${f.entityId}` : `/app/tareas/${f.entityId}`}>
                      {f.entityTitle}
                    </Link>{' '}
                    <small className="text-secondary">({f.entityType === 'process' ? 'proceso' : 'tarea'})</small>
                  </td>
                  <td>{formatBytes(f.size)}</td>
                  <td>{f.uploaderName}</td>
                  <td>{formatDate(f.createdAt)}</td>
                  <td>
                    <Button
                      size="sm"
                      variant="outline-primary"
                      aria-label={`Descargar ${f.name}`}
                      onClick={() => download(f).catch(showError)}
                    >
                      <FiDownload aria-hidden="true" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

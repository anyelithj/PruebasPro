import { useRef, useState } from 'react'
import { Alert, Button, Form } from 'react-bootstrap'
import { FiDownload, FiTrash2, FiUpload } from 'react-icons/fi'
import { useAuth } from '../../hooks/useAuth'
import { useFiles } from '../../hooks/useFiles'
import type { FileRecord } from '../../models'
import { activeBackend, formatBytes } from '../../services/fileStorage'
import { formatDate } from '../helpers/ConvertirId'
import { confirmDelete, showError } from '../helpers/confirm'

interface Props {
  entityType: FileRecord['entityType']
  entityId: string
  entityTitle: string
}

/** Adjuntos de un proceso o tarea: subir, listar, descargar y eliminar. */
export default function FileManager({ entityType, entityId, entityTitle }: Props) {
  const { files, upload, download, remove } = useFiles(entityType, entityId)
  const { can, user } = useAuth()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onPick = async (list: FileList | null) => {
    if (!list?.length) return
    setBusy(true)
    setError(null)
    try {
      for (const f of Array.from(list)) await upload(f, entityType, entityId, entityTitle)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir el archivo.')
    }
    setBusy(false)
    if (input.current) input.current.value = ''
  }

  return (
    <div>
      {can('file:upload') && (
        <div className="mb-3">
          <Form.Label htmlFor={`file-${entityId}`}>
            <FiUpload aria-hidden="true" /> Adjuntar archivos
          </Form.Label>
          <Form.Control
            id={`file-${entityId}`}
            ref={input}
            type="file"
            multiple
            disabled={busy}
            onChange={(e) => onPick((e.target as HTMLInputElement).files)}
            aria-describedby={`file-help-${entityId}`}
          />
          <Form.Text id={`file-help-${entityId}`}>
            Tamaño máximo: {formatBytes(activeBackend.maxBytes)} por archivo.
          </Form.Text>
        </div>
      )}
      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
      {files.length === 0 ? (
        <p className="text-secondary mb-0">No hay archivos adjuntos.</p>
      ) : (
        <ul className="row-list mt-0">
          {files.map((f) => (
            <li key={f.id} className="row-list__item">
              <div>
                <strong>{f.name}</strong>
                <div className="small text-secondary">
                  {formatBytes(f.size)} · {f.uploaderName} · {formatDate(f.createdAt)}
                </div>
              </div>
              <div className="row-list__actions">
                <Button
                  size="sm"
                  variant="outline-primary"
                  onClick={() => download(f).catch(showError)}
                  aria-label={`Descargar ${f.name}`}
                >
                  <FiDownload aria-hidden="true" /> Descargar
                </Button>
                {(can('file:delete') || f.uploadedBy === user?.uid) && (
                  <Button
                    size="sm"
                    variant="outline-danger"
                    aria-label={`Eliminar ${f.name}`}
                    onClick={async () => {
                      if (await confirmDelete(`¿Eliminar «${f.name}»?`)) await remove(f).catch(showError)
                    }}
                  >
                    <FiTrash2 aria-hidden="true" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

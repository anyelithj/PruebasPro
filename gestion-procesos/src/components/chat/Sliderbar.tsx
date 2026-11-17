import { useState, type FormEvent } from 'react'
import { Button, Form } from 'react-bootstrap'
import type { Channel } from '../../models'
import CanalEnSidebar from './CanalEnSidebar'

interface Props {
  channels: Channel[]
  canCreate: boolean
  onCreate: (name: string) => Promise<unknown>
}

export default function Sliderbar({ channels, canCreate, onCreate }: Props) {
  const [name, setName] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await onCreate(name)
    setName('')
  }
  return (
    <aside className="chat__sidebar" aria-label="Canales">
      <h2 className="h6">Canales</h2>
      {channels.length === 0 && <p className="small text-secondary">Crea el primer canal, por ejemplo «general».</p>}
      <ul className="chat__channels">
        {channels.map((c) => (
          <CanalEnSidebar key={c.id} channel={c} />
        ))}
      </ul>
      {canCreate && (
        <Form onSubmit={submit}>
          <Form.Label htmlFor="nuevo-canal" className="small">
            Nuevo canal
          </Form.Label>
          <Form.Control id="nuevo-canal" size="sm" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" size="sm" className="mt-2" variant="outline-light">
            Crear
          </Button>
        </Form>
      )}
    </aside>
  )
}

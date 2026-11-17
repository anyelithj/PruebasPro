import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DEFAULT_WORKFLOW } from '../../../services/workflow'
import ProcessForm, { emptyProcess } from '../ProcessForm'

jest.mock('../../../hooks/useUsers', () => ({ useUsers: () => ({ users: [], nameOf: () => 'Sin asignar' }) }))
jest.mock('../../../hooks/useWorkflow', () => ({
  useWorkflow: () => ({ workflows: [DEFAULT_WORKFLOW], getWorkflow: () => DEFAULT_WORKFLOW }),
}))

describe('ProcessForm (crear, editar y ver con los mismos campos)', () => {
  it('crear: exige el título', async () => {
    const onSubmit = jest.fn()
    render(<ProcessForm mode="create" onSubmit={onSubmit} />)
    await userEvent.click(screen.getByRole('button', { name: 'Crear proceso' }))
    expect(screen.getByRole('alert')).toHaveTextContent('El título es obligatorio.')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('crear: envía los datos con el primer estado del flujo', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined)
    render(<ProcessForm mode="create" onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText(/Título/), '  Alta de proveedor  ')
    await userEvent.click(screen.getByRole('button', { name: 'Crear proceso' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: 'Alta de proveedor', status: 'Borrador' }))
  })

  it('crear: no acepta una fecha de inicio posterior a la fecha límite', async () => {
    render(
      <ProcessForm
        mode="create"
        initial={{ ...emptyProcess, title: 'X', startDate: '2026-12-10', dueDate: '2026-12-01' }}
        onSubmit={jest.fn()}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Crear proceso' }))
    expect(screen.getByRole('alert')).toHaveTextContent('fecha de inicio')
  })

  it('editar: conserva el estado actual y no permite cambiar el flujo', () => {
    render(
      <ProcessForm
        mode="edit"
        initial={{ ...emptyProcess, title: 'Informe' }}
        currentStatus="En revisión"
        submitLabel="Guardar cambios"
        onSubmit={jest.fn()}
      />,
    )
    expect(screen.getByLabelText('Estado')).toHaveValue('En revisión')
    expect(screen.getByLabelText('Flujo de trabajo')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument()
  })

  it('ver: muestra los mismos campos bloqueados, sin botón ni ayuda de IA', () => {
    render(<ProcessForm mode="view" initial={{ ...emptyProcess, title: 'Informe' }} currentStatus="Borrador" />)
    expect(screen.getByLabelText('Título')).toHaveValue('Informe')
    expect(screen.getByLabelText('Título')).toBeDisabled()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

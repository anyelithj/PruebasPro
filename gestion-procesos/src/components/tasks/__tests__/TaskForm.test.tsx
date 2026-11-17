import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TaskForm from '../TaskForm'

jest.mock('../../../hooks/useUsers', () => ({ useUsers: () => ({ users: [] }) }))
jest.mock('../../../hooks/useProcesses', () => ({
  useProcesses: () => ({ processes: [{ id: 'p1', title: 'Proceso 1' }] }),
}))

describe('TaskForm (crear, editar y ver con los mismos campos)', () => {
  it('crear: exige el título', async () => {
    render(<TaskForm mode="create" onSubmit={jest.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Crear tarea' }))
    expect(screen.getByRole('alert')).toHaveTextContent('El título es obligatorio.')
  })

  it('crear: envía la tarea y limpia el formulario si se pide', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined)
    render(<TaskForm mode="create" processId="p1" resetOnSubmit onSubmit={onSubmit} />)
    const title = screen.getByLabelText(/Título/)
    await userEvent.type(title, 'Revisar contrato')
    await userEvent.click(screen.getByRole('button', { name: 'Crear tarea' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Revisar contrato', processId: 'p1', status: 'todo' }),
    )
    expect(title).toHaveValue('')
  })

  it('con processId no muestra el selector de proceso', () => {
    render(<TaskForm mode="create" processId="p1" onSubmit={jest.fn()} />)
    expect(screen.queryByLabelText('Proceso')).not.toBeInTheDocument()
  })

  it('ver: campos bloqueados y sin botón', () => {
    render(
      <TaskForm
        mode="view"
        initial={{
          title: 'Tarea',
          description: '',
          processId: 'p1',
          priority: 'high',
          status: 'doing',
          assigneeId: '',
          dueDate: '2026-12-01',
        }}
      />,
    )
    expect(screen.getByLabelText('Título')).toBeDisabled()
    expect(screen.getByLabelText('Prioridad')).toHaveValue('high')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

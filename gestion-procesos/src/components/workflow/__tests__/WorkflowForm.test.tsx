import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WorkflowForm, { parseStates } from '../WorkflowForm'

describe('WorkflowForm', () => {
  it('parseStates limpia espacios y vacíos', () => {
    expect(parseStates(' Recibida, , En análisis ,Resuelta ')).toEqual(['Recibida', 'En análisis', 'Resuelta'])
  })

  it('crear: exige al menos dos estados', async () => {
    const onSubmit = jest.fn()
    render(<WorkflowForm mode="create" onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText('Nombre del flujo'), 'Soporte')
    await userEvent.type(screen.getByLabelText('Estados en orden'), 'Recibida')
    await userEvent.click(screen.getByRole('button', { name: 'Crear flujo' }))
    expect(screen.getByRole('alert')).toHaveTextContent('al menos dos estados')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('crear: envía nombre y estados', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined)
    render(<WorkflowForm mode="create" onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText('Nombre del flujo'), 'Soporte')
    await userEvent.type(screen.getByLabelText('Estados en orden'), 'Recibida, Resuelta')
    await userEvent.click(screen.getByRole('button', { name: 'Crear flujo' }))
    expect(onSubmit).toHaveBeenCalledWith('Soporte', ['Recibida', 'Resuelta'])
  })

  it('ver: muestra los estados bloqueados y el recorrido', () => {
    render(<WorkflowForm mode="view" initial={{ name: 'Soporte', states: 'Recibida, Resuelta' }} />)
    expect(screen.getByLabelText('Estados en orden')).toBeDisabled()
    expect(screen.getByRole('list', { name: 'Estados del flujo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Crear|Guardar/ })).not.toBeInTheDocument()
  })
})

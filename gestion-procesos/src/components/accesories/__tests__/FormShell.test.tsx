import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FormShell from '../FormShell'

describe('FormShell', () => {
  it('en modo create muestra el botón y envía el formulario', async () => {
    const onSubmit = jest.fn()
    render(
      <FormShell mode="create" label="Formulario de prueba" onSubmit={onSubmit}>
        <input aria-label="nombre" />
      </FormShell>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Crear' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('en modo edit usa «Guardar cambios» por defecto', () => {
    render(
      <FormShell mode="edit" label="f">
        {null}
      </FormShell>,
    )
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument()
  })

  it('en modo view bloquea los campos y no muestra el botón', () => {
    render(
      <FormShell mode="view" label="f" onSubmit={jest.fn()}>
        <input aria-label="nombre" />
      </FormShell>,
    )
    expect(screen.getByLabelText('nombre')).toBeDisabled()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('muestra el error como alerta accesible', () => {
    render(
      <FormShell mode="create" label="f" error="Algo salió mal">
        {null}
      </FormShell>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Algo salió mal')
  })
})

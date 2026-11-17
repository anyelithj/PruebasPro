import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UserForm, { emptyUser } from '../UserForm'

describe('UserForm (crear, editar y ver con los mismos campos)', () => {
  it('crear: pide correo válido y contraseña de 6 caracteres', async () => {
    const onSubmit = jest.fn()
    render(<UserForm mode="create" onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText(/Nombre completo/), 'Ana Gómez')
    await userEvent.type(screen.getByLabelText(/Correo/), 'no-es-correo')
    await userEvent.click(screen.getByRole('button', { name: 'Crear usuario' }))
    expect(screen.getByRole('alert')).toHaveTextContent('correo válido')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('crear: envía los datos correctos', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined)
    render(<UserForm mode="create" onSubmit={onSubmit} />)
    await userEvent.type(screen.getByLabelText(/Nombre completo/), 'Ana Gómez')
    await userEvent.type(screen.getByLabelText(/Correo/), 'ana@empresa.co')
    await userEvent.type(screen.getByLabelText(/Contraseña inicial/), 'secreto1')
    await userEvent.click(screen.getByRole('button', { name: 'Crear usuario' }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'Ana Gómez', email: 'ana@empresa.co', role: 'member' }),
    )
  })

  it('editar: el correo no se puede cambiar y no pide contraseña', () => {
    render(
      <UserForm
        mode="edit"
        initial={{ ...emptyUser, displayName: 'Ana', email: 'ana@empresa.co' }}
        onSubmit={jest.fn()}
      />,
    )
    expect(screen.getByLabelText(/Correo/)).toBeDisabled()
    expect(screen.queryByLabelText(/Contraseña inicial/)).not.toBeInTheDocument()
  })

  it('ver: sin botón y sin cambiar el rol de uno mismo', () => {
    render(
      <UserForm
        mode="view"
        isSelf
        initial={{ ...emptyUser, displayName: 'Ana', email: 'ana@empresa.co', role: 'admin' }}
      />,
    )
    expect(screen.getByLabelText('Rol')).toHaveValue('admin')
    expect(screen.getByLabelText('Rol')).toBeDisabled()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

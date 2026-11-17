import { screen } from '@testing-library/react'
import { renderWithRouter } from '../../../test/renderWithRouter'
import ProtectedRoute from '../ProtectedRoute'

const mockCan = jest.fn()
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ can: mockCan }) }))

describe('ProtectedRoute', () => {
  it('muestra el contenido cuando el rol tiene el permiso', () => {
    mockCan.mockReturnValue(true)
    renderWithRouter(
      <ProtectedRoute permission="users:manage">
        <p>Panel de usuarios</p>
      </ProtectedRoute>,
    )
    expect(screen.getByText('Panel de usuarios')).toBeInTheDocument()
  })

  it('muestra un aviso accesible cuando falta el permiso', () => {
    mockCan.mockReturnValue(false)
    renderWithRouter(
      <ProtectedRoute permission="users:manage">
        <p>Panel de usuarios</p>
      </ProtectedRoute>,
    )
    expect(screen.queryByText('Panel de usuarios')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('No tienes permiso')
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/app')
  })
})

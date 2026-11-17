import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'

/** Renderiza un componente dentro de un enrutador en memoria. */
export const renderWithRouter = (ui: ReactElement, route = '/') =>
  render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>)

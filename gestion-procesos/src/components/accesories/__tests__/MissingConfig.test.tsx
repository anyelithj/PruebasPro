import { render, screen } from '@testing-library/react'
import MissingConfig from '../MissingConfig'

describe('MissingConfig', () => {
  it('explica el problema y lista las variables que faltan', () => {
    render(<MissingConfig missing={['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_APP_ID']} />)
    expect(screen.getByRole('heading', { name: 'Falta configurar Firebase' })).toBeInTheDocument()
    expect(screen.getByText('VITE_FIREBASE_API_KEY')).toBeInTheDocument()
    expect(screen.getByText('VITE_FIREBASE_APP_ID')).toBeInTheDocument()
    expect(screen.getByText(/pnpm env:check/)).toBeInTheDocument()
    // Sin variables cargadas, explica que Vite no está leyendo el .env
    expect(screen.getByText('Ninguna variable.')).toBeInTheDocument()
  })

  it('muestra los nombres (no los valores) de las variables que Vite sí cargó y el modo', () => {
    render(<MissingConfig missing={['VITE_FIREBASE_APP_ID']} loaded={['VITE_FIREBASE_API_KEY']} mode="development" />)
    expect(screen.getByText('VITE_FIREBASE_API_KEY')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /modo development/ })).toBeInTheDocument()
    expect(screen.queryByText('Ninguna variable.')).not.toBeInTheDocument()
  })
})

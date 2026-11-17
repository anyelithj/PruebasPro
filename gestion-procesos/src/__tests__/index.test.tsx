import { act, screen, waitFor } from '@testing-library/react'

// Simula un .env sin configurar: es exactamente la situación que producía «auth/invalid-api-key».
jest.mock('../config/env', () => ({
  env: {
    appName: 'Gestión de Procesos',
    missingFirebaseKeys: ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_APP_ID'],
    loadedEnvKeys: [],
    mode: 'development',
  },
}))
// Si el arranque intentara cargar la aplicación (y con ella Firebase), esta prueba fallaría.
jest.mock('../AppRoot', () => {
  throw new Error('No se debe cargar la aplicación sin configuración de Firebase')
})

describe('arranque de la aplicación (index.tsx)', () => {
  it('sin claves de Firebase muestra la pantalla de ayuda en vez de romperse', async () => {
    document.body.innerHTML = '<div id="root"></div>'
    // `act` deja que React termine de dibujar antes de comprobar la pantalla.
    await act(async () => {
      await import('../index')
    })
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Falta configurar Firebase' })).toBeInTheDocument())
    expect(screen.getByText('VITE_FIREBASE_API_KEY')).toBeInTheDocument()
  })
})

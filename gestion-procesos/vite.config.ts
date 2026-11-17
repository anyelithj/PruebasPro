import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Aplicación 100% CSR: Vite solo compila y sirve archivos estáticos.
export default defineConfig({
  plugins: [react()],
  // Se aceptan variables VITE_* y también REACT_APP_* (nombres de Create React App) para facilitar la migración.
  envPrefix: ['VITE_', 'REACT_APP_'],
  css: {
    preprocessorOptions: {
      scss: {
        quietDeps: true,
        silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
      },
    },
  },
})

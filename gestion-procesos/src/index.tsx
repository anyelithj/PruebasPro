// ═══════════════════════════════════════════════════════════════════════════════════════
// index.tsx — PUNTO DE ENTRADA de la aplicación (lo primero que ejecuta el navegador).
// Arquitectura: capa de PRESENTACIÓN. Aquí se «enchufan» React y Redux al HTML (index.html).
// Renderizado: CSR (Client-Side Rendering) → React dibuja la página en el navegador, no en un servidor.
//
// Protección de arranque: si faltan las claves de Firebase (.env), NO se carga la aplicación (cuyo código inicia Firebase
// y lanzaría «auth/invalid-api-key»); en su lugar se muestra una pantalla que explica cómo configurarlo.
// ═══════════════════════════════════════════════════════════════════════════════════════

// `import`: trae código que otro archivo exporta. StrictMode ejecuta controles extra en desarrollo.
import { StrictMode } from 'react'
// `createRoot`: crea la «raíz» donde React dibujará toda la interfaz.
import { createRoot } from 'react-dom/client'
import MissingConfig from './components/accesories/MissingConfig'
// `env`: variables de entorno ya leídas (incluye `missingFirebaseKeys`). No importa Firebase.
import { env } from './config/env'
// Import «de efecto»: Vite compila y carga los estilos Sass (SMACSS + BEM).
import './styles/config.scss'

// `async function`: función asíncrona; permite usar `await` para cargar módulos bajo demanda.
async function main() {
  // `as HTMLElement`: aserción de TypeScript (getElementById podría devolver null, pero sabemos que existe).
  const root = createRoot(document.getElementById('root') as HTMLElement)

  // Sin configuración completa: pantalla de ayuda y se corta aquí (`return`).
  if (env.missingFirebaseKeys.length > 0) {
    root.render(<MissingConfig missing={env.missingFirebaseKeys} loaded={env.loadedEnvKeys} mode={env.mode} />)
    return
  }

  // Con configuración: se importan la app y el store RECIÉN ahora (importación dinámica). Así Firebase solo se inicia
  // cuando las claves existen. `Promise.all` carga ambos módulos en paralelo.
  const [{ default: AppRoot }, { store }, { Provider }] = await Promise.all([
    import('./AppRoot'),
    import('./redux/store/store'),
    import('react-redux'),
  ])

  // Paradigma DECLARATIVO: describimos QUÉ interfaz queremos (JSX) y React decide CÓMO actualizar el DOM.
  root.render(
    <StrictMode>
      {/* Provider (Context API): pone el store de Redux a disposición de todos los componentes. */}
      <Provider store={store}>
        <AppRoot />
      </Provider>
    </StrictMode>,
  )
}

// `void`: se ejecuta la función sin esperar su resultado (no hay nada más que hacer después).
void main()

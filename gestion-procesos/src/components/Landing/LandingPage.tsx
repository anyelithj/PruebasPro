import { env } from '../../config/env'
import { Link } from 'react-router-dom'
import '../../styles/styleLanding.scss'
import Seo from '../accesories/Seo'

const FEATURES = [
  {
    title: 'Procesos y solicitudes',
    text: 'Cada trámite tiene responsable, fecha límite y estado dentro de su flujo de trabajo.',
  },
  {
    title: 'Tablero y calendario',
    text: 'Mueve tareas entre columnas y revisa vencimientos del mes en una sola vista.',
  },
  { title: 'Analítica clara', text: 'Mira cuántos procesos están activos, cuáles vencen y cómo avanza el equipo.' },
  {
    title: 'Chat con traducción',
    text: 'Conversa en español o inglés. La traducción se hace en tu navegador, sin costo.',
  },
]

export default function LandingPage() {
  return (
    <div className="landing">
      <Seo
        title="Gestiona procesos, tareas y flujos de trabajo"
        description="Procesos, solicitudes, tareas, workflows, tablero Kanban, calendario, analítica y chat con traducción en un solo lugar."
      />
      <header className="landing__top">
        <span className="landing__brand">{env.appName}</span>
        <nav aria-label="Acceso">
          <Link to="/login" className="btn btn-outline-light btn-sm me-2">
            Iniciar sesión
          </Link>
          <Link to="/registro" className="btn btn-warning btn-sm">
            Crear cuenta
          </Link>
        </nav>
      </header>

      <main id="contenido" tabIndex={-1}>
        <section className="landing__hero" aria-labelledby="hero-title">
          <div className="landing__hero-text">
            <h1 id="hero-title">Cada proceso con su responsable, su fecha y su estado.</h1>
            <p>
              Deja de perseguir solicitudes por correo y hojas de cálculo. Organiza el trabajo del equipo y mira en qué
              punto está cada cosa.
            </p>
            <Link to="/registro" className="btn btn-warning btn-lg">
              Empezar ahora
            </Link>
          </div>

          <div
            className="landing__board"
            role="img"
            aria-label="Ejemplo de tablero con tres columnas: por hacer, en curso y hecha"
          >
            {[
              { name: 'Por hacer', cards: ['Aprobar presupuesto', 'Revisar contrato'] },
              { name: 'En curso', cards: ['Solicitud de acceso', 'Informe mensual', 'Alta de proveedor'] },
              { name: 'Hecha', cards: ['Cierre de nómina'] },
            ].map((col) => (
              <div className="landing__col" key={col.name} aria-hidden="true">
                <strong>{col.name}</strong>
                {col.cards.map((c) => (
                  <span className="landing__card" key={c}>
                    {c}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="landing__features" aria-labelledby="features-title">
          <h2 id="features-title" className="h4">
            Lo que puedes hacer
          </h2>
          <dl>
            {FEATURES.map((f) => (
              <div key={f.title}>
                <dt>{f.title}</dt>
                <dd>{f.text}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <footer className="landing__footer">
        © {new Date().getFullYear()} {env.appName}
      </footer>
    </div>
  )
}

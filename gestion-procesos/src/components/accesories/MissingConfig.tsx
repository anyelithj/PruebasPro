// MissingConfig.tsx — pantalla que se muestra cuando falta configurar Firebase (archivo .env).
// Importante: este componente NO importa Firebase; por eso puede mostrarse aunque la configuración esté incompleta
// (sin esta pantalla, Firebase lanza el error «auth/invalid-api-key» y la página queda en blanco).

interface Props {
  /** Nombres de las variables de entorno que faltan. */
  missing: string[]
  /** Nombres (nunca valores) de las variables VITE_/REACT_APP_ que Vite sí cargó. Sirve para diagnosticar. */
  loaded?: string[]
  /** Modo de Vite (development, production…). */
  mode?: string
}

export default function MissingConfig({ missing, loaded = [], mode }: Props) {
  return (
    <main className="l-auth" id="contenido">
      <section className="auth-card" aria-labelledby="config-title" style={{ maxWidth: '44rem' }}>
        <h1 id="config-title" className="h3">
          Falta configurar Firebase
        </h1>
        <p>
          La aplicación necesita las claves de tu proyecto de Firebase para iniciar sesión y guardar datos. Todavía no
          las encuentra.
        </p>

        <h2 className="h6">Variables que faltan o están vacías</h2>
        <ul>
          {missing.map((name) => (
            <li key={name}>
              <code>{name}</code>
            </li>
          ))}
        </ul>

        <h2 className="h6">Qué leyó la aplicación{mode ? ` (modo ${mode})` : ''}</h2>
        {loaded.length === 0 ? (
          <p>
            <strong>Ninguna variable.</strong> Vite no está cargando tu archivo <code>.env</code>. Revisa que:
          </p>
        ) : (
          <>
            <p>
              Variables cargadas (solo nombres):{' '}
              {loaded.map((name, i) => (
                <span key={name}>
                  {i > 0 && ', '}
                  <code>{name}</code>
                </span>
              ))}
            </p>
            <p>Si las de arriba no aparecen aquí, revisa que:</p>
          </>
        )}
        <ul>
          <li>
            El archivo se llame exactamente <code>.env</code> (no <code>.env.txt</code>, <code>env</code> ni{' '}
            <code>.env.example</code>) y esté en la <strong>raíz del proyecto</strong>, junto a{' '}
            <code>package.json</code>.
          </li>
          <li>
            Cada línea tenga el formato <code>NOMBRE=valor</code>, sin espacios alrededor del <code>=</code>, y los
            nombres empiecen con <code>VITE_</code>.
          </li>
          <li>
            Los valores no estén vacíos y hayas <strong>reiniciado</strong> el servidor después de editar el archivo (
            <code>Ctrl + C</code> y <code>pnpm dev</code>).
          </li>
        </ul>

        <h2 className="h6">Comprobarlo desde la terminal</h2>
        <p>
          Ejecuta <code>pnpm env:check</code> en la carpeta del proyecto: te dice qué variable falta y por qué, sin
          mostrar tus claves.
        </p>

        <h2 className="h6">Si usas Docker</h2>
        <p className="mb-0">
          El archivo <code>.env</code> debe estar junto a <code>docker-compose.yml</code>. Vite incrusta los valores al
          compilar: después de editarlo ejecuta <code>docker compose up --build -d</code> (sin <code>--build</code> se
          reutiliza la imagen anterior, que quedó sin claves).
        </p>
      </section>
    </main>
  )
}

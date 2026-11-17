// ProfileLoadError.tsx — pantalla que explica por qué NO se pudo cargar el perfil del usuario.
// Sin perfil no hay rol ni permisos, y la aplicación ocultaría todos los botones sin decir nada; por eso se muestra esto.

interface Props {
  /** Mensaje de error guardado en Redux, con el código de Firebase entre paréntesis. */
  message: string | null
  onRetry: () => void
  onLogout: () => void
}

export default function ProfileLoadError({ message, onRetry, onLogout }: Props) {
  const denied = message?.includes('permission-denied')
  return (
    <main className="l-auth" id="contenido">
      <section className="auth-card" aria-labelledby="perfil-error-title" style={{ maxWidth: '44rem' }}>
        <h1 id="perfil-error-title" className="h3">
          No pudimos cargar tu perfil
        </h1>
        <p role="alert">
          {message ?? 'Firestore no respondió.'} Sin el perfil no hay rol ni permisos, por eso no verías los botones de
          crear, editar, ver detalle y eliminar, ni el historial ni los workflows.
        </p>
        <p>
          {denied
            ? 'Firebase rechazó la lectura (permission-denied). Casi siempre significa que las reglas de seguridad no están publicadas o que la base de datos no existe.'
            : 'Casi siempre significa que la base de datos Firestore no existe, las reglas no están publicadas o no hay conexión.'}
        </p>

        <h2 className="h6">Cómo solucionarlo</h2>
        <ol>
          <li>
            En Firebase Console abre <strong>Compilación → Firestore Database</strong>. Si no hay base de datos, pulsa{' '}
            <strong>Crear base de datos</strong>.
          </li>
          <li>
            Abre la pestaña <strong>Reglas</strong>, pega todo el contenido del archivo <code>firestore.rules</code> del
            proyecto y pulsa <strong>Publicar</strong>. (Alternativa por terminal:{' '}
            <code>pnpm db:deploy --project ID-DE-TU-PROYECTO</code>, después de <code>firebase login</code>).
          </li>
          <li>
            Confirma que en <strong>Authentication → Método de acceso</strong> están activados Correo/contraseña y
            Google.
          </li>
          <li>
            Pulsa <strong>Reintentar</strong>. El primer usuario que entra queda como <strong>administrador</strong> y
            ve todos los botones.
          </li>
        </ol>

        <div className="d-flex gap-2">
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            Reintentar
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      </section>
    </main>
  )
}

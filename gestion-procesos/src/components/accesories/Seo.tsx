import { env } from '../../config/env'

interface SeoProps {
  title: string
  description?: string
  /** Páginas privadas: evita que los buscadores las indexen. */
  noIndex?: boolean
}

const APP_NAME = env.appName

/** React 19 mueve <title> y <meta> automáticamente al <head>. */
export default function Seo({ title, description, noIndex = false }: SeoProps) {
  const fullTitle = `${title} · ${APP_NAME}`
  return (
    <>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      {noIndex && <meta name="robots" content="noindex,nofollow" />}
    </>
  )
}

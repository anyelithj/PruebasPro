import { useCallback, useState } from 'react'
import { detectLanguage, translateText, type Lang } from '../services/translation'

export function useTranslation() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const translate = useCallback(async (text: string, to: Lang): Promise<string | null> => {
    setLoading(true)
    setError(null)
    try {
      return await translateText(text, detectLanguage(text), to)
    } catch {
      setError('No se pudo traducir. Revisa tu conexión: la primera vez se descarga el modelo.')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { translate, loading, error }
}

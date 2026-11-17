import type { Lang } from '../models'

export type { Lang }
export const LANG_LABEL: Record<Lang, string> = { es: 'Español', en: 'English' }

const ES_WORDS = /\b(el|la|los|las|de|que|y|en|un|una|para|con|por|es|no|se|del|al|esto|hola|gracias|está|más)\b/g
const EN_WORDS = /\b(the|and|of|to|in|is|that|for|with|this|are|you|not|have|hello|thanks|it|on)\b/g

export function detectLanguage(text: string): Lang {
  const t = text.toLowerCase()
  const es = (t.match(ES_WORDS) ?? []).length + (/[ñáéíóú¿¡]/.test(t) ? 2 : 0)
  const en = (t.match(EN_WORDS) ?? []).length
  return es >= en ? 'es' : 'en'
}

type Translator = (text: string, options?: object) => Promise<{ translation_text: string }[]>
const translators = new Map<string, Promise<Translator>>()

/** Traducción gratuita y sin API key: modelos Opus-MT (Helsinki-NLP) ejecutados en el navegador con Transformers.js. */
function getTranslator(from: Lang, to: Lang): Promise<Translator> {
  const key = `${from}-${to}`
  if (!translators.has(key)) {
    translators.set(
      key,
      (async () => {
        const { pipeline, env } = await import('@huggingface/transformers')
        env.allowLocalModels = false
        const create = pipeline as unknown as (task: string, model: string) => Promise<Translator>
        return create('translation', `Xenova/opus-mt-${key}`)
      })(),
    )
  }
  return translators.get(key) as Promise<Translator>
}

export async function translateText(text: string, from: Lang, to: Lang): Promise<string> {
  if (from === to) return text
  try {
    const translator = await getTranslator(from, to)
    const [result] = await translator(text, { max_new_tokens: 256 })
    return result.translation_text
  } catch (error) {
    translators.delete(`${from}-${to}`)
    throw error
  }
}

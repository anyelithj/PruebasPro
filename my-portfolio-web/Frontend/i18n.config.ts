// i18n.config.ts
//---------------------------------------------
// ❶ NO importes desde 'nuxt-i18n'
// ❷ Opcional: si quieres completar tipos, usa '#imports'

import es from './locales/es.json'
import en from './locales/en.json'
import fr from './locales/fr.json'
import de from './locales/de.json'
import pt from './locales/pt.json'

export default defineI18nConfig(() => ({
  legacy: false,
  locale: 'es',
  fallbackLocale: 'es',
  messages: {
    es,
    en,
    fr,
    de,
    pt
  }
}))

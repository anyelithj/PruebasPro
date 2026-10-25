// [Capa: Infrastructure/Adapters — implementación concreta del Port ISocialLinksRepository.]
// [Hexagonal: traduce datos hardcodeados (fuente externa simple) al modelo de dominio.]
// [Patrón: Repository Adapter. SOLID/DIP cumplido: el dominio no sabe de este archivo.]

// [typescript: import type — import del contrato a implementar.]
import type { ISocialLinksRepository } from '../../domain/ports/ISocialLinksRepository'
import type { SocialLink } from '../../domain/entities/SocialLink'

// [typescript: const + as const — congela tipo literal y readonly. Inmutabilidad estructural.]
// [Por qué: previene mutación accidental, mejora type narrowing.]
const LINKS: readonly SocialLink[] = [
  // [Cada objeto = entidad SocialLink. id literal estrechado por SocialPlatformId.]
  {
    id: 'github',
    name: 'GitHub',
    url: 'https://github.com/tu_usuario',
    icon: ['fab', 'github'],
    colorClass: 'text-gray-800 dark:text-white',
  },
  {
    id: 'twitter',
    name: 'Twitter',
    url: 'https://twitter.com/tu_usuario',
    icon: ['fab', 'twitter'],
    colorClass: 'text-sky-500',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    url: 'https://linkedin.com/in/tu_usuario',
    icon: ['fab', 'linkedin'],
    colorClass: 'text-blue-700 dark:text-blue-400',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    url: 'https://wa.me/tu_numero',
    icon: ['fab', 'whatsapp'],
    colorClass: 'text-green-500',
  },
  {
    id: 'discord',
    name: 'Discord',
    url: 'https://discordapp.com/users/tu_usuario',
    icon: ['fab', 'discord'],
    colorClass: 'text-indigo-500',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    url: 'https://t.me/tu_usuario',
    icon: ['fab', 'telegram'],
    colorClass: 'text-blue-500',
  },
] as const

// [typescript: function — factory del adapter. Devuelve un objeto que cumple el Port.]
// [Patrón: Factory Function en lugar de class — sin `this`, más predecible, mejor con tree-shaking.]
export function createStaticSocialLinksRepository(): ISocialLinksRepository {
  return {
    // [getAll — devuelve la fuente. La readonly del array protege la inmutabilidad.]
    getAll: () => LINKS,
  }
}

// [Capa: Domain — entidades del negocio. Hexagonal: núcleo aislado, sin imports de framework.]
// [Paradigma: Tipado estructural funcional. Solo tipos puros, cero efectos.]

// [typescript: type — alias literal union, restringe valores admitidos en compile-time. Patrón: branded primitives.]
// [Por qué: SOLID/OCP — añadir nueva red = ampliar union, código consumidor no rompe.]
export type SocialPlatformId =
  | 'github'
  | 'twitter'
  | 'linkedin'
  | 'whatsapp'
  | 'discord'
  | 'telegram'

// [typescript: readonly tuple — [string, string] inmutable. Coincide con FontAwesome IconDefinition (prefix, iconName).]
// [Por qué: representa contrato del icono sin acoplar al SDK FontAwesome aquí (DIP).]
export type FontAwesomeIconRef = readonly [prefix: string, name: string]

// [typescript: interface — contrato de entidad SocialLink. Patrón DDD: entidad de dominio.]
// [Atomic Design: usado por organism SocialLinksSection vía molecule SocialIconList.]
export interface SocialLink {
  // [SRP: cada propiedad describe un solo aspecto del enlace social.]
  readonly id: SocialPlatformId      // [readonly: inmutable tras construcción — invariante de dominio.]
  readonly name: string              // [Etiqueta humana, usada en aria-label (a11y).]
  readonly url: string               // [URL absoluta. Validación delegada a la capa de infrastructure.]
  readonly icon: FontAwesomeIconRef  // [Referencia abstracta al icono. Adapter FontAwesome traduce.]
  readonly colorClass: string        // [Clase Tailwind. Presentación, no lógica — separa UI de dominio (anti-corruption).]
}

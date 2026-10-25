// [Capa: Domain — entidad Skill.]
// [Paradigma: Tipado puro, sin runtime.]

// [Reutilizamos FontAwesomeIconRef desde SocialLink para no duplicar (DRY).]
// [typescript: import type — solo tipos, no genera código JS — tree-shaking-friendly.]
import type { FontAwesomeIconRef } from './SocialLink'

// [typescript: interface — contrato de habilidad técnica.]
// [SRP: describe una habilidad y nada más.]
export interface Skill {
  readonly id: string                  // [Identificador estable, p.ej. 'vue', 'react'.]
  readonly name: string                // [Nombre mostrado por atom SkillBadge.]
  readonly icon: FontAwesomeIconRef    // [Icono via Font Awesome (dep: @fortawesome).]
  readonly isBrand: boolean            // [Determina paleta: marca (azul) vs neutro. Anti-condicional disperso (Tell-Don't-Ask).]
}

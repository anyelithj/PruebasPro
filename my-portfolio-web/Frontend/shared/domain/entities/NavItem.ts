// [Capa: Domain — entidad de navegación.]
// [Paradigma: Tipado estructural.]

// [typescript: interface — describe un ítem del menú principal.]
export interface NavItem {
  readonly to: string          // [Ruta o ancla destino (NuxtLink to).]
  readonly hash: string        // [Hash si la ruta es un ancla — usado por isActive.]
  readonly i18nKey: string     // [Clave i18n (dep: @nuxtjs/i18n). Desacopla texto de markup (SOLID/OCP).]
}

// [typescript: interface — idioma soportado por el portafolio.]
export interface SupportedLocale {
  readonly code: string        // [ISO 639-1 — 'es', 'en', etc.]
  readonly flag: string        // [Emoji bandera. Pres. visual.]
  readonly name: string        // [Nombre nativo del idioma.]
}

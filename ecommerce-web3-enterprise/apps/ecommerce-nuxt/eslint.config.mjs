// eslint.config.mjs (ESLint 9 flat config) => reglas de ecommerce-nuxt.
// Patrón Composition + OCP: parte de las reglas Vue/Nuxt (generadas por el módulo @nuxt/eslint) y AGREGA las reglas
// Clean Code del monorepo, igual que ecommerce-next extiende la suya. DRY: las reglas base viven en un solo lugar.
import withNuxt from "./.nuxt/eslint.config.mjs"; // Generado por "nuxt prepare" (postinstall): parser de .vue + auto-imports
import { cleanCodeRules } from "@ecommerce/eslint-config"; // Import con nombre: solo las reglas, no el parser de TS

// "withNuxt(...)" => agrega bloques DESPUÉS de los de Nuxt (el último gana). Solo "rules": el parser de .vue queda intacto
export default withNuxt({
  files: ["**/*.ts", "**/*.vue"],
  rules: {
    ...cleanCodeRules,
    // Nombres de una palabra permitidos: las convenciones de Nuxt (page.vue, error.vue, layouts) y el kit de UI
    // compartido (Button, Modal... igual que shared/ui de Next) los usan; los componentes de negocio sí son compuestos
    "vue/multi-word-component-names": "off",
  },
});

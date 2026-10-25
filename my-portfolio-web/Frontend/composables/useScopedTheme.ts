// [Capa: Composables — gestión de tema scoped por sección.]
// [Patrón Vue: Composable. SOLID/SRP: solo aplica/quita `.dark` en secciones target.]
// [Razón: el usuario quiere modo light/dark SOLO en las secciones
//  About, Projects, Skills, Contact — no en navbar, hero, footer, social.]

import { onMounted, onBeforeUnmount, watch } from 'vue'
import { useColorMode } from '#imports'

// [IDs de las secciones donde aplicar el tema.]
const SCOPED_SECTION_IDS = ['about', 'projects', 'skills', 'contact'] as const

export function useScopedTheme() {
  const colorMode = useColorMode()

  // [Función pura — aplica/quita `.dark` en los nodos target según el value.]
  const apply = (value: string) => {
    if (typeof document === 'undefined') return
    const isDark = value === 'dark'
    SCOPED_SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id)
      if (!el) return
      el.classList.toggle('dark', isDark)
    })
  }

  // [MutationObserver — si la sección se monta después (SPA), re-aplica al aparecer.]
  let observer: MutationObserver | null = null

  onMounted(() => {
    // [Aplica estado inicial.]
    apply(colorMode.value)

    // [Reactivo al cambio de tema (toggle del botón).]
    watch(
      () => colorMode.value,
      (v) => apply(v),
    )

    // [Observa el árbol — si las secciones aparecen después, re-aplica.]
    observer = new MutationObserver(() => apply(colorMode.value))
    observer.observe(document.body, { childList: true, subtree: true })
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
    observer = null
  })
}

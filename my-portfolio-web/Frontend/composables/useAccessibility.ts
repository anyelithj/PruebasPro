// // composables/useAccessibility.ts
// import { onMounted } from 'vue'
// import { ACCESSIBLE_KEYS } from '@/shared/constants'

// export function useAccessibility(actions: Record<string, () => void>) {
//   onMounted(() => {
//     window.addEventListener('keydown', (e) => {
//       const action = ACCESSIBLE_KEYS[e.key as keyof typeof ACCESSIBLE_KEYS]
//       if (action && actions[action]) actions[action]()
//     })
//   })
// }
// composables/useAccessibility.ts

/**
 * useAccessibility - composable para mejorar la accesibilidad del sitio
 * Detecta si el usuario prefiere animaciones reducidas y expone helpers de accesibilidad.
 */

import { ref, onMounted, watchEffect } from 'vue'

export function useAccessibility() {
  // Detectar si el usuario prefiere reducir el movimiento (animaciones)
  const prefersReducedMotion = ref(false)

  const updateMotionPreference = () => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    prefersReducedMotion.value = mediaQuery.matches
  }

  onMounted(() => {
    updateMotionPreference()

    // Escuchar cambios en la preferencia del sistema
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    mediaQuery.addEventListener('change', () => {
      prefersReducedMotion.value = mediaQuery.matches
    })
  })

  // Helper para enfoque visual accesible (por ejemplo al usar teclado)
  const prefersFocusVisible = ref(false)

  onMounted(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') prefersFocusVisible.value = true
    }

    const handleMouseDown = () => {
      prefersFocusVisible.value = false
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('mousedown', handleMouseDown)
  })

  return {
    prefersReducedMotion,
    prefersFocusVisible
  }
}

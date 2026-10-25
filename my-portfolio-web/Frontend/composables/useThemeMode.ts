// [Capa: Composables — wrapper único sobre el modo color (light/dark).]
// [SOLID/DRY: reemplaza la mezcla previa useTheme + useDarkMode + useDarkModeToggle (3 archivos haciendo lo mismo).]
// [dep: @nuxtjs/color-mode — useColorMode auto-importado por el módulo.]
// [Patrón Vue: Composable + State Management ligero (state vive en color-mode).]

// [vue: computed — derivado reactivo.]
import { computed, type ComputedRef } from 'vue'

// [typescript: type — restringe modos válidos. Source of truth.]
export type ThemeMode = 'light' | 'dark' | 'system'

// [Composable canónico de tema.]
export function useThemeMode(): {
  mode: ComputedRef<ThemeMode>     // [Modo actual.]
  isDark: ComputedRef<boolean>     // [Atajo para condicionales.]
  setMode: (m: ThemeMode) => void  // [Setter explícito (Tell-Don't-Ask).]
  toggle: () => void               // [Alterna light↔dark sin pasar por system.]
} {
  // [useColorMode — auto-import del módulo @nuxtjs/color-mode. Reactivo.]
  // [typescript: any cast evita conflicto con tipos del module si el augment no está cargado.]
  const colorMode = useColorMode()

  const mode = computed<ThemeMode>(() => colorMode.preference as ThemeMode)
  const isDark = computed(() => colorMode.value === 'dark')

  // [Setter — encapsula la mutación de la preferencia.]
  const setMode = (m: ThemeMode) => {
    colorMode.preference = m
  }

  // [Toggle — alterna sólo entre claro y oscuro (omitimos 'system' explícito por UX).]
  const toggle = () => {
    setMode(isDark.value ? 'light' : 'dark')
  }

  return { mode, isDark, setMode, toggle }
}

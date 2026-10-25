
// // utils/themeUtils.ts
// export const applyTheme = (theme: 'light' | 'dark') => {
//   document.documentElement.classList.toggle('dark', theme === 'dark')
// }
// 📁 utils/themeUtils.ts
import { Theme } from '@/shared/enums'

export function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? Theme.DARK
    : Theme.LIGHT
}


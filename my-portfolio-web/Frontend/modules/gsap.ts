// modules/gsap.ts
// import { defineNuxtModule } from '@nuxt/kit'

// export default defineNuxtModule({
//   setup(_, nuxt) {
//     nuxt.options.build.transpile.push('gsap')
//   }
// })


// // 📁 modules/gsap.ts
// import gsap from 'gsap'

// export function animateFadeIn(el: Element, delay = 0) {
//   gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 1, delay })
// }
// modules/gsap.ts

import { defineNuxtModule, addPlugin, createResolver } from '@nuxt/kit'

// Define el módulo personalizado para GSAP
export default defineNuxtModule({
  meta: {
    name: 'gsap-module',
    configKey: 'gsap',
  },

  defaults: {},

  setup(_, nuxt) {
    const resolver = createResolver(import.meta.url)

    // Añadir el plugin que se usará del lado del cliente
    addPlugin(resolver.resolve('../plugins/gsap.client'))
  }
})

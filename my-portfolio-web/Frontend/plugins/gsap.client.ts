// // plugins/gsap.client.ts
// import { defineNuxtPlugin } from '#app'
// import { gsap } from 'gsap'

// export default defineNuxtPlugin(() => {
//   return {
//     provide: { gsap }
//   }
// })

// plugins/gsap.client.ts

// import { defineNuxtPlugin } from '#app'
// import gsap from 'gsap'

// export default defineNuxtPlugin(() => {
//   // GSAP se puede usar globalmente desde el contexto del plugin
//   return {
//     provide: {
//       gsap,
//     },
//   }
// })
// import { defineNuxtPlugin } from '#imports'
// import gsap from 'gsap'

// export default defineNuxtPlugin(() => ({
//   provide: { gsap }
// }))
// plugins/gsap.client.ts
// plugins/gsap.client.ts  (el sufijo .client es importante)
// plugins/gsap.client.ts
// import { defineNuxtPlugin } from '#imports'
// import gsap from 'gsap'
// import { CSSPlugin } from 'gsap/CSSPlugin'

// // 👇 ¡registramos el plugin explícitamente!
// gsap.registerPlugin(CSSPlugin)

// export default defineNuxtPlugin(() => {
//   return {
//     provide: {
//       gsap
//     }
//   }
// })
// // plugins/gsap.client.ts   (ya existe?  añade la línea de CSSPlugin)
// import { gsap } from 'gsap'
// import CSSPlugin from 'gsap/CSSPlugin'   // ⭐️  ← importante

// // fuerza la tree-shake de CSSPlugin
// gsap.registerPlugin(CSSPlugin)

// export default defineNuxtPlugin((nuxtApp) => {
//   nuxtApp.vueApp.config.globalProperties.$gsap = gsap
// })

// plugins/gsap.client.ts
import { gsap } from 'gsap'
import { TextPlugin } from 'gsap/TextPlugin'
import { CustomEase } from 'gsap/CustomEase'
import { CSSPlugin } from 'gsap/CSSPlugin' // Asegúrate de que CSSPlugin esté registrado

gsap.registerPlugin(TextPlugin, CustomEase, CSSPlugin)

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.config.globalProperties.$gsap = gsap
  return {
    provide: {
      gsap,
      TextPlugin,
      CustomEase,
      CSSPlugin,
    },
  }
})
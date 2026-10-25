// // plugins/particles.client.ts
// import { defineNuxtPlugin } from '#app'
// import Particles from 'vue3-particles'

// export default defineNuxtPlugin((nuxtApp) => {
//   nuxtApp.vueApp.use(Particles)
// })
// // plugins/particles.client.ts
// import { defineNuxtPlugin } from '#app'
// import { tsParticles } from 'tsparticles-engine'

// export default defineNuxtPlugin(() => {
//   return {
//     provide: { tsParticles }
//   }
// })
// // 📁 plugins/particles.client.ts
// import { defineNuxtPlugin } from '#app'

// export default defineNuxtPlugin(() => {
//   if (process.client) {
//     import('tsparticles').then((module) => {
//       console.log('Particles plugin loaded')
//     })
//   }
// })
// plugins/particles.client.ts
// export default defineNuxtPlugin(() => {
//   const config = useRuntimeConfig()
//   console.log('Public config:', config.public)
// })
// plugins/particles.client.ts

// import { tsParticles } from 'tsparticles-engine'
// import { loadFull } from 'tsparticles'

// export default defineNuxtPlugin(async () => {
//   await loadFull(tsParticles)
// })

// import { defineNuxtPlugin } from "#app"
// import { tsParticles } from "tsparticles-engine"
// import { loadFull } from "tsparticles"

// export default defineNuxtPlugin(async () => {
//   try {
//     await loadFull(tsParticles)
//   } catch (error) {
//     console.error("Error loading tsParticles:", error)
//   }
// })
import { defineNuxtPlugin } from "#app"
import Particles from "vue3-particles"

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(Particles)
})

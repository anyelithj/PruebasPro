
// // modules/particles.ts
// import { defineNuxtModule } from '@nuxt/kit'

// export default defineNuxtModule({
//   setup(_, nuxt) {
//     nuxt.options.build.transpile.push('tsparticles')
//   }
// })


// // 📁 modules/particles.ts
// import { tsParticles } from 'tsparticles-engine'
// import { loadFull } from 'tsparticles'

// export async function initParticlesEngine(containerId: string) {
//   await loadFull(tsParticles)
//   return tsParticles.load(containerId, {
//     fullScreen: { enable: true },
//     background: { color: '#000' },
//     particles: {
//       color: { value: '#ffffff' },
//       links: { enable: true, color: '#ffffff', distance: 150 },
//       move: { enable: true, speed: 2 },
//       number: { value: 60 },
//       opacity: { value: 0.5 },
//       size: { value: { min: 1, max: 4 } },
//     },
//   })
// }

// modules/particles.ts

// import { defineNuxtModule, addPlugin } from '@nuxt/kit'

// export default defineNuxtModule({
//   meta: {
//     name: 'particles',
//     configKey: 'particles',
//   },
//   setup() {
//     addPlugin(resolve(__dirname, './particles.plugin'))
//   },
// })


// modules/particles.ts
import { defineNuxtModule } from '@nuxt/kit'

export default defineNuxtModule({
  meta: {
    name: 'particles',
    configKey: 'particles'
  },
  setup(_, nuxt) {
    console.log('Particles module loaded')
  }
})

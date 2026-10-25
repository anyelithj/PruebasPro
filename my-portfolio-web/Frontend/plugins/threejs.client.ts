// // plugins/threejs.client.ts
// import { defineNuxtPlugin } from '#app'
// import * as THREE from 'three'

// export default defineNuxtPlugin(() => {
//   return {
//     provide: { three: THREE }
//   }
// })
// 📁 plugins/threejs.client.ts
import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin(() => {
  if (process.client) {
    // Lazy load Three.js
    import('three').then((THREE) => {
      console.log('Three.js ready:', THREE)
    })
  }
})

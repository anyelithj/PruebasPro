// import { defineNuxtPlugin } from '#app'
// import { library, dom } from '@fortawesome/fontawesome-svg-core'
// import { faBars, faTimes, faStar } from '@fortawesome/free-solid-svg-icons'
// import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

// // Íconos sólidos
// import {
//   faEnvelope, faMoon, faSun, faCode, faUser
// } from '@fortawesome/free-solid-svg-icons'

// // Íconos de marcas
// import {
//   faGithub, faLinkedin, faTwitter,
//   faWhatsapp, faTelegram, faDiscord,
// } from '@fortawesome/free-brands-svg-icons'

// // Agrega todos los íconos al library para uso global
// library.add(
//   faEnvelope, faMoon, faSun, faCode, faUser,
//   faGithub, faLinkedin, faTwitter,
//   faWhatsapp, faTelegram, faDiscord,
//   faBars, faTimes, faStar
// )

// export default defineNuxtPlugin((nuxtApp) => {
//   dom.watch()
//   nuxtApp.vueApp.component('FontAwesomeIcon', FontAwesomeIcon)
// })
// plugins/fontawesome.ts
import { defineNuxtPlugin } from '#app'
import { library, dom } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { fas } from '@fortawesome/free-solid-svg-icons'
import { fab } from '@fortawesome/free-brands-svg-icons'
import { faArrowUp } from '@fortawesome/free-solid-svg-icons'

// Íconos sólidos
import {
  faEnvelope, faMoon, faSun, faCode, faUser,
  faBars, faTimes, faStar, faPaperPlane // ✅ AÑADIR AQUÍ
} from '@fortawesome/free-solid-svg-icons'

// Íconos de marcas
import {
  faGithub, faLinkedin, faTwitter,
  faWhatsapp, faTelegram, faDiscord,
} from '@fortawesome/free-brands-svg-icons'

library.add(
  faEnvelope, faMoon, faSun, faCode, faUser,
  faBars, faTimes, faStar, faPaperPlane, // ✅ AÑADIR AQUÍ TAMBIÉN
  faGithub, faLinkedin, faTwitter,
  faWhatsapp, faTelegram, faDiscord,
  fas, fab, faArrowUp
)

export default defineNuxtPlugin((nuxtApp) => {
  dom.watch()
  nuxtApp.vueApp.component('FontAwesomeIcon', FontAwesomeIcon)
})

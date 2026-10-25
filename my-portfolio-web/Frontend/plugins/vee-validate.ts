// // plugins/vee-validate.ts
// import { defineRule } from 'vee-validate'
// import { required, email } from '@vee-validate/rules'

// export default defineNuxtPlugin(() => {
//   defineRule('required', required)
//   defineRule('email', email)
// })

// plugins/vee-validate.ts
import { defineRule, configure } from 'vee-validate'
import { required, email } from '@vee-validate/rules'
import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin(() => {
  defineRule('required', required)
  defineRule('email', email)

  configure({
    generateMessage: (ctx) => {
      const messages: Record<string, string> = {
        required: `El campo ${ctx.field} es obligatorio.`,
        email: `El campo ${ctx.field} debe ser un correo válido.`,
      }
      return messages[ctx.rule?.name!] || `El campo ${ctx.field} no es válido.`
    },
  })
})

// vee-validate.ts (plugin de Nuxt + Vee-Validate) => comportamiento global de los formularios (Decorator de config):
// se valida al salir del campo y al enviar, NO en cada tecla (menos trabajo de CPU y sin regañar antes de terminar
// de escribir). Los schemas son Zod (toTypedSchema en cada feature): una sola librería de validación con Express.
import { configure } from "vee-validate";

export default defineNuxtPlugin(() => {
  configure({
    validateOnBlur: true,
    validateOnChange: true,
    validateOnInput: false,
    validateOnModelUpdate: false,
  });
});

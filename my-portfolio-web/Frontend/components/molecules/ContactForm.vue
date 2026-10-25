<!--
  [Atomic Design: Molecule — formulario de contacto.]
  [Patrón Vue: Container/Presentational híbrido — contiene la lógica de validación local;
   ideal para extraer a composable si la complejidad crece (YAGNI hoy).]
  [dep: vee-validate — useForm + useField. Esquema con yup.]
  [Animaciones: entrada en stagger (cada campo aparece con leve delay),
   submit-success → confetti-style pulse del botón.]
-->
<script setup lang="ts">
// [dep: vee-validate — gestor de formularios reactivo.]
import { useForm, useField } from 'vee-validate'
// [dep: yup — schema-based validation.]
import * as yup from 'yup'
import { ref } from 'vue'
// [Atoms.]
import AppInput from '~/components/atoms/AppInput.vue'
import AppTextarea from '~/components/atoms/AppTextarea.vue'
import AppButton from '~/components/atoms/AppButton.vue'
// [Composable de stagger en GSAP — reutiliza el patrón del ProjectsSection.]
import { useGsapStagger } from '~/composables/useGsapStagger'
import { useToast } from '~/composables/useToast'
import { useContactClassify } from '~/composables/useContactClassify'
import type { ContactInput } from '~/shared/schemas/contact.schema'

// [typescript: yup schema — fuente única de validación.]
// [SOLID/SRP: validación encapsulada en el schema, no dispersa por handlers.]
const schema = yup.object({
  name: yup.string().required('El nombre es obligatorio'),
  email: yup.string().email('Correo inválido').required('El correo es obligatorio'),
  message: yup.string().min(10, 'El mensaje debe tener al menos 10 caracteres').required('Escribe tu mensaje'),
})

// [vee-validate: useForm — devuelve handleSubmit + errors reactivos.]
// [initialValues: '' — evita warning de Vue "Expected String, got Undefined" al primer render.]
const { handleSubmit, errors, isSubmitting, resetForm } = useForm({
  validationSchema: schema,
  initialValues: { name: '', email: '', message: '' },
})

// [vee-validate: useField('name') — vincula campo al schema, valor reactivo + validación.]
const { value: name } = useField<string>('name')
const { value: email } = useField<string>('email')
const { value: message } = useField<string>('message')

// [Refs para stagger de entrada del formulario.]
const formEl = ref<HTMLFormElement | null>(null)
useGsapStagger(formEl, { y: 18, duration: 0.6, stagger: 0.1 })

// [Estado de "enviado" para flash visual de éxito en el botón.]
const justSent = ref(false)
const toast = useToast()
// [ML] clasificación del mensaje (oferta/freelance/spam) — FastAPI, best-effort.
const classifier = useContactClassify()
const CATEGORY_LABEL: Record<string, string> = {
  job: 'Oferta de empleo',
  freelance: 'Freelance',
  spam: 'Spam',
}

// [MVC-C] el form no habla con el backend directo: pasa por el BFF Nitro (/api/contact),
// que revalida con Zod y reenvía al backend activo (Nest | FastAPI).
const onSubmit = handleSubmit(async (values) => {
  try {
    await $fetch('/api/contact', { method: 'POST', body: values as ContactInput })
    justSent.value = true
    setTimeout(() => (justSent.value = false), 1400)
    toast.success('Gracias por tu mensaje 🚀 Te respondo pronto.')

    // [ML] clasifica el mensaje para mostrar la categoría detectada (no bloquea el envío).
    const cls = await classifier.classify(values.message)
    if (cls) {
      toast.success(`Mensaje clasificado como “${CATEGORY_LABEL[cls.category] ?? cls.category}”`)
    }

    resetForm()
  } catch (e) {
    toast.error(`No se pudo enviar: ${(e as Error).message}`)
  }
})
</script>

<template>
  <!--
    [novalidate — desactiva la validación nativa del browser para que vee-validate la maneje.]
    [aria-label sobre el form para SR.]
  -->
  <form
    ref="formEl"
    novalidate
    aria-label="Formulario de contacto"
    @submit.prevent="onSubmit"
    class="space-y-5"
  >
    <div data-field>
      <AppInput
        id="contact-name"
        v-model="name"
        label="Nombre"
        placeholder="Tu nombre"
        autocomplete="name"
        :error="errors.name"
      />
    </div>

    <div data-field>
      <AppInput
        id="contact-email"
        v-model="email"
        label="Correo"
        type="email"
        placeholder="ejemplo@correo.com"
        autocomplete="email"
        :error="errors.email"
      />
    </div>

    <div data-field>
      <AppTextarea
        id="contact-message"
        v-model="message"
        label="Mensaje"
        placeholder="Tu mensaje"
        :rows="4"
        :error="errors.message"
      />
    </div>

    <div class="text-center" data-field>
      <AppButton
        type="submit"
        variant="primary"
        :disabled="isSubmitting"
        :class="{ 'submit-pulse': justSent }"
      >
        {{ isSubmitting ? 'Enviando…' : 'Enviar' }}
      </AppButton>
    </div>
  </form>
</template>

<style scoped>
/* [Pulse de éxito tras submit — escala + glow.] */
.submit-pulse {
  animation: submitPulse 1.2s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes submitPulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.6);
  }
  40% {
    transform: scale(1.06);
    box-shadow: 0 0 0 14px rgba(59, 130, 246, 0);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .submit-pulse {
    animation: none !important;
  }
}
</style>

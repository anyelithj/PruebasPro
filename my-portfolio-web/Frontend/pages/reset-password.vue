<!-- [MVC-V] consume el token del enlace (?token=) y fija la contraseña nueva. -->
<script setup lang="ts">
import { reactive, ref } from 'vue';
import { definePageMeta, useRoute, useRouter } from '#imports';
import PasswordField from '~/components/molecules/PasswordField.vue';
import { useAuthStore } from '~/stores/useAuthStore';
import { useToast } from '~/composables/useToast';
import { resetPasswordFormSchema } from '~/shared/schemas/auth.schema';

definePageMeta({ layout: 'auth' });

const auth = useAuthStore();
const toast = useToast();
const route = useRoute();
const router = useRouter();

const token = (route.query.token as string) ?? '';
const form = reactive({ password: '', confirmPassword: '' });
const fieldErrors = reactive<Record<string, string>>({});
const done = ref(false);

function validate(): boolean {
  const result = resetPasswordFormSchema.safeParse(form);
  fieldErrors.password = '';
  fieldErrors.confirmPassword = '';
  if (result.success) return true;
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string') fieldErrors[key] = issue.message;
  }
  return false;
}

async function submit(): Promise<void> {
  if (!validate()) return;
  try {
    await auth.resetPassword({ token, password: form.password });
    done.value = true;
    toast.success('Contraseña actualizada. Inicia sesión.');
    await router.push('/login');
  } catch (e) {
    toast.error((e as Error).message);
  }
}
</script>

<template>
  <section class="card">
    <header class="card__head">
      <h1 class="card__title">Nueva contraseña</h1>
      <p class="card__subtitle">Elige una contraseña de al menos 8 caracteres.</p>
    </header>

    <!-- Sin token en la URL no hay nada que resetear. -->
    <div v-if="!token" class="notice notice--error">
      <p class="notice__title">Enlace inválido</p>
      <p class="notice__text">
        Este enlace no trae token. Pide uno nuevo desde "Recuperar contraseña".
      </p>
      <NuxtLink to="/forgot-password" class="notice__back">Pedir enlace nuevo</NuxtLink>
    </div>

    <form v-else-if="!done" class="form" @submit.prevent="submit">
      <PasswordField
        id="new-password"
        v-model="form.password"
        label="Contraseña nueva"
        autocomplete="new-password"
        :minlength="8"
        :error="fieldErrors.password"
      />

      <PasswordField
        id="confirm-new-password"
        v-model="form.confirmPassword"
        label="Repetir contraseña"
        autocomplete="new-password"
        :error="fieldErrors.confirmPassword"
      />

      <button type="submit" class="form__submit" :disabled="auth.loading">
        {{ auth.loading ? '...' : 'Guardar contraseña' }}
      </button>

      <NuxtLink to="/login" class="form__back">Volver a iniciar sesión</NuxtLink>
    </form>

    <p v-if="auth.error" class="form__error">{{ auth.error }}</p>
  </section>
</template>

<style scoped>
.card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 1.25rem;
  padding: 2rem;
  box-shadow: 0 20px 45px -25px rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(8px);
}
:global(.dark) .card {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.08);
}
.card__head {
  margin-bottom: 1.25rem;
}
.card__title {
  font-size: 1.6rem;
  font-weight: 800;
  color: rgb(17 24 39);
}
:global(.dark) .card__title {
  color: white;
}
.card__subtitle {
  margin-top: 0.35rem;
  font-size: 0.9rem;
  color: rgb(107 114 128);
}
.form {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.form__submit {
  margin-top: 0.35rem;
  padding: 0.75rem;
  border-radius: 0.6rem;
  border: none;
  background: linear-gradient(90deg, #a562ff, #6366f1);
  color: white;
  font-weight: 700;
  cursor: pointer;
}
.form__submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.form__back,
.notice__back {
  align-self: center;
  font-size: 0.85rem;
  color: rgb(99 102 241);
  text-decoration: none;
}
.form__back:hover,
.notice__back:hover {
  text-decoration: underline;
}
.form__error {
  color: #ef4444;
  font-size: 0.85rem;
  margin-top: 0.75rem;
}
.notice {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1.1rem;
  border-radius: 0.8rem;
  border: 1px solid rgba(99, 102, 241, 0.3);
  background: rgba(99, 102, 241, 0.08);
}
.notice--error {
  border-color: rgba(239, 68, 68, 0.35);
  background: rgba(239, 68, 68, 0.08);
}
.notice__title {
  font-weight: 700;
  color: rgb(185 28 28);
}
.notice__text {
  font-size: 0.9rem;
  color: rgb(55 65 81);
}
:global(.dark) .notice__text {
  color: rgb(209 213 219);
}
</style>

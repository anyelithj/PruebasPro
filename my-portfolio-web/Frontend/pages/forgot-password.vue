<!-- [MVC-V] pide el email y dispara el envío del enlace de reseteo. -->
<script setup lang="ts">
import { ref } from 'vue';
import { definePageMeta } from '#imports';
import { useAuthStore } from '~/stores/useAuthStore';
import { useToast } from '~/composables/useToast';

definePageMeta({ layout: 'auth' });

const auth = useAuthStore();
const toast = useToast();

const email = ref('');
const sent = ref(false);

async function submit(): Promise<void> {
  try {
    await auth.forgotPassword({ email: email.value });
    // Mensaje neutro: el backend responde igual exista o no la cuenta.
    sent.value = true;
  } catch (e) {
    toast.error((e as Error).message);
  }
}
</script>

<template>
  <section class="card">
    <header class="card__head">
      <h1 class="card__title">Recuperar contraseña</h1>
      <p class="card__subtitle">
        Escribe tu email y te enviaremos un enlace para crear una contraseña nueva.
      </p>
    </header>

    <div v-if="sent" class="notice">
      <p class="notice__title">Revisa tu correo</p>
      <p class="notice__text">
        Si <strong>{{ email }}</strong> tiene una cuenta, le enviamos un enlace para restablecer la
        contraseña. El enlace vence en 30 minutos.
      </p>
      <p class="notice__hint">
        Todavía no hay servicio de correo conectado: en desarrollo el enlace aparece en los logs del
        backend ({{ auth.provider.toUpperCase() }}).
      </p>
      <NuxtLink to="/login" class="notice__back">Volver a iniciar sesión</NuxtLink>
    </div>

    <form v-else class="form" @submit.prevent="submit">
      <label class="form__field">
        <span class="form__label">Email</span>
        <input
          v-model="email"
          type="email"
          class="form__input"
          required
          autocomplete="email"
          placeholder="tucorreo@ejemplo.com"
        />
      </label>

      <button type="submit" class="form__submit" :disabled="auth.loading">
        {{ auth.loading ? '...' : 'Enviar enlace' }}
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
.form__field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.form__label {
  font-size: 0.85rem;
  font-weight: 600;
  color: rgb(55 65 81);
}
:global(.dark) .form__label {
  color: rgb(209 213 219);
}
.form__input {
  width: 100%;
  padding: 0.65rem 0.85rem;
  border-radius: 0.6rem;
  border: 1px solid rgb(209 213 219);
  background: white;
  color: rgb(17 24 39);
}
:global(.dark) .form__input {
  border-color: rgba(255, 255, 255, 0.15);
  background: rgba(15, 23, 42, 0.6);
  color: white;
}
.form__input:focus {
  outline: none;
  border-color: rgb(129 140 248);
  box-shadow: 0 0 0 3px rgba(129, 140, 248, 0.25);
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
.notice__title {
  font-weight: 700;
  color: rgb(67 56 202);
}
:global(.dark) .notice__title {
  color: rgb(165 180 252);
}
.notice__text {
  font-size: 0.9rem;
  color: rgb(55 65 81);
}
:global(.dark) .notice__text {
  color: rgb(209 213 219);
}
.notice__hint {
  font-size: 0.75rem;
  color: rgb(107 114 128);
}
</style>

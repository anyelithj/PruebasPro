<!-- [MVC-V] vista de auth — solo compone; delega toda la lógica al useAuthStore. -->
<script setup lang="ts">
import { reactive } from 'vue';
import { definePageMeta, useRoute, useRouter } from '#imports';
import PasswordField from '~/components/molecules/PasswordField.vue';
import { useAuthStore } from '~/stores/useAuthStore';
import { useToast } from '~/composables/useToast';
import type { ApiProvider } from '~/shared/api/contracts';

definePageMeta({ layout: 'auth' });

const auth = useAuthStore();
const toast = useToast();
const route = useRoute();
const router = useRouter();

// Portafolio personal: solo login. La cuenta ADMIN se siembra en el backend, sin registro público.
const form = reactive({ email: '', password: '' });

function selectProvider(p: ApiProvider): void {
  auth.setProvider(p);
}

async function submit(): Promise<void> {
  try {
    await auth.login({ email: form.email, password: form.password });
    toast.success(`Autenticado vía ${auth.provider.toUpperCase()}`);
    const redirect = (route.query.redirect as string) || '/admin';
    await router.push(redirect);
  } catch (e) {
    toast.error((e as Error).message);
  }
}
</script>

<template>
  <section class="card">
    <header class="card__head">
      <h1 class="card__title">Iniciar sesión</h1>
      <p class="card__subtitle">Acceso al panel de administración.</p>
    </header>

    <!-- [STRATEGY] selector de backend en runtime -->
    <div class="provider">
      <span class="provider__label">Backend:</span>
      <button
        type="button"
        :class="['provider__btn', { 'provider__btn--active': auth.provider === 'nest' }]"
        @click="selectProvider('nest')"
      >
        NestJS
      </button>
      <button
        type="button"
        :class="['provider__btn', { 'provider__btn--active': auth.provider === 'fastapi' }]"
        @click="selectProvider('fastapi')"
      >
        FastAPI
      </button>
    </div>

    <form class="form" @submit.prevent="submit">
      <label class="form__field">
        <span class="form__label">Email</span>
        <input
          v-model="form.email"
          type="email"
          class="form__input"
          required
          autocomplete="email"
        />
      </label>

      <PasswordField
        id="password"
        v-model="form.password"
        label="Contraseña"
        autocomplete="current-password"
      />

      <NuxtLink to="/forgot-password" class="form__forgot">
        ¿Olvidaste tu contraseña?
      </NuxtLink>

      <button type="submit" class="form__submit" :disabled="auth.loading">
        {{ auth.loading ? '...' : 'Entrar' }}
      </button>
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
  margin-top: 0.25rem;
  font-size: 0.9rem;
  color: rgb(107 114 128);
}
.provider {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}
.provider__label {
  font-size: 0.85rem;
  opacity: 0.7;
}
.provider__btn {
  padding: 0.35rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(15, 23, 42, 0.15);
  font-size: 0.85rem;
  cursor: pointer;
  background: transparent;
}
:global(.dark) .provider__btn {
  border-color: rgba(255, 255, 255, 0.15);
}
.provider__btn--active {
  background: rgb(99, 102, 241);
  color: white;
  border-color: rgb(99, 102, 241);
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
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
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
.form__forgot {
  align-self: flex-end;
  font-size: 0.8rem;
  color: rgb(99 102 241);
  text-decoration: none;
}
.form__forgot:hover {
  text-decoration: underline;
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
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.form__submit:hover:not(:disabled) {
  transform: translateY(-1px);
}
.form__submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.form__error {
  color: #ef4444;
  font-size: 0.85rem;
  margin-top: 0.75rem;
}
.switch {
  margin-top: 1rem;
  background: none;
  border: none;
  color: rgb(99 102 241);
  cursor: pointer;
  font-size: 0.85rem;
}
.switch:hover {
  text-decoration: underline;
}
</style>

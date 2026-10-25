// [FLUX][SRP] estado de autenticación JWT — Action → Store → View (Pinia).
// Consume /auth y /users/me de Nest o FastAPI según el provider seleccionado.
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useCookie } from '#app';
import { useApi } from '~/composables/useApi';
import type { ApiProvider, AuthTokens, AuthUser } from '~/shared/api/contracts';
import { Role } from '~/shared/enums';
import type {
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
} from '~/shared/schemas/auth.schema';

// Normaliza la respuesta de auth (Nest camelCase / FastAPI snake_case) a un shape único.
function normalizeTokens(raw: Record<string, unknown>): AuthTokens {
  return {
    accessToken: (raw.accessToken ?? raw.access_token) as string,
    refreshToken: (raw.refreshToken ?? raw.refresh_token) as string,
    tokenType: (raw.tokenType ?? raw.token_type ?? 'bearer') as string,
    user: raw.user as AuthUser,
  };
}

export const useAuthStore = defineStore('auth', () => {
  // Persistencia en cookies (SSR-safe). access_token lo lee useApi para el header Bearer.
  const accessToken = useCookie<string | null>('access_token', { sameSite: 'lax' });
  const refreshToken = useCookie<string | null>('refresh_token', { sameSite: 'lax' });
  const providerCookie = useCookie<ApiProvider>('api_provider', { sameSite: 'lax' });

  const user = ref<AuthUser | null>(null);
  const provider = ref<ApiProvider>(providerCookie.value || 'nest');
  const loading = ref(false);
  const error = ref<string | null>(null);

  const isAuthenticated = computed(() => Boolean(accessToken.value));
  // Portafolio personal: la única cuenta es ADMIN. Guarda las rutas /admin.
  const isAdmin = computed(() => user.value?.role === Role.ADMIN);

  function setProvider(next: ApiProvider): void {
    provider.value = next;
    providerCookie.value = next;
  }

  function persist(tokens: AuthTokens): void {
    accessToken.value = tokens.accessToken;
    refreshToken.value = tokens.refreshToken;
    user.value = tokens.user;
  }

  async function login(input: LoginInput): Promise<void> {
    await run(async () => {
      const raw = await useApi(provider.value).post<Record<string, unknown>>('/auth/login', input);
      persist(normalizeTokens(raw));
    });
  }

  // El backend responde igual exista o no el email; el enlace sale por sus logs.
  async function forgotPassword(input: ForgotPasswordInput): Promise<void> {
    await run(async () => {
      await useApi(provider.value).post('/auth/forgot-password', input);
    });
  }

  async function resetPassword(input: ResetPasswordInput): Promise<void> {
    await run(async () => {
      await useApi(provider.value).post('/auth/reset-password', input);
    });
  }

  async function fetchMe(): Promise<void> {
    if (!accessToken.value) return;
    user.value = await useApi(provider.value).get<AuthUser>('/users/me');
  }

  // Actualiza el propio perfil vía PATCH /users/:id (el backend permite ADMIN o propietario).
  async function updateProfile(input: { name?: string; email?: string }): Promise<void> {
    if (!user.value) return;
    await run(async () => {
      const updated = await useApi(provider.value).patch<AuthUser>(
        `/users/${user.value!.id}`,
        input,
      );
      // El backend devuelve el usuario actualizado; si no, re-consultamos /users/me.
      user.value = updated ?? user.value;
      await fetchMe();
    });
  }

  async function refresh(): Promise<void> {
    if (!refreshToken.value) return;
    const raw = await useApi(provider.value).post<Record<string, unknown>>('/auth/refresh', {
      // enviamos ambas claves; cada backend usa la suya.
      refreshToken: refreshToken.value,
      refresh_token: refreshToken.value,
    });
    persist(normalizeTokens(raw));
  }

  async function logout(): Promise<void> {
    try {
      if (refreshToken.value) {
        await useApi(provider.value).post('/auth/logout', {
          refreshToken: refreshToken.value,
          refresh_token: refreshToken.value,
        });
      }
    } finally {
      accessToken.value = null;
      refreshToken.value = null;
      user.value = null;
    }
  }

  async function run(fn: () => Promise<void>): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      await fn();
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  return {
    user,
    provider,
    loading,
    error,
    isAuthenticated,
    isAdmin,
    setProvider,
    login,
    forgotPassword,
    resetPassword,
    fetchMe,
    updateProfile,
    refresh,
    logout,
  };
});

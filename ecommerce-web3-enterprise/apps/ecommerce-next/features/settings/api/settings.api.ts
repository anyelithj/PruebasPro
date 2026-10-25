// settings.api.ts => configuración de la cuenta: perfil, contraseña, 2FA, preferencias de notificación y baja (GDPR).
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { signOut } from "next-auth/react";
import { useLocale } from "next-intl";
import { getPathname } from "@/shared/lib/i18n/navigation";
import { apiGet, apiRequest } from "@/shared/lib/api-client";
import { queryKeys } from "@/shared/lib/query-client";
import { useAuth } from "@/shared/hook/useAuth";
import { userApi } from "@/entities/user/api/user.api";
import type { UserProfile } from "@/entities/user/model/user.types";
import { signWalletChallenge } from "@/shared/lib/wallet";
import type { PasswordFormValues, ProfileFormValues } from "../lib/settings.validator";

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  inApp: boolean;
  marketing: boolean;
  whatsapp: boolean; // RF-16.1 (requiere celular verificado)
  sms: boolean;
}

// useSettingsActions => mutaciones de la cuenta; "ctx" evita repetir token/userId en cada una (DRY)
export function useSettingsActions() {
  const { user, accessToken } = useAuth();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const ctx = { token: accessToken as string, userId: user?.id ?? "" };

  return {
    updateProfile: useMutation({
      // Teléfono vacío => null: el backend borra el dato (exactOptionalPropertyTypes no admite undefined)
      mutationFn: (values: ProfileFormValues) => userApi.updateProfile(ctx.token, ctx.userId, { ...values, phone: values.phone || null, birthDate: values.birthDate || null }),
      onSuccess: (profile: UserProfile) => queryClient.setQueryData(queryKeys.profile(ctx.userId), profile),
    }),
    changePassword: useMutation({ mutationFn: (values: PasswordFormValues) => userApi.changePassword(ctx.token, ctx.userId, values) }),
    setTwoFactor: useMutation({
      mutationFn: ({ enabled, password }: { enabled: boolean; password: string }) => apiRequest("/auth/2fa", { method: "PATCH", token: ctx.token, body: { enabled, password } }),
      onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.profile(ctx.userId) }),
    }),
    // Vincular wallet: la firma demuestra que el usuario controla la dirección (habilita login Web3 y NFT)
    linkWallet: useMutation({
      mutationFn: async () => apiRequest("/auth/web3/link", { method: "POST", token: ctx.token, body: await signWalletChallenge() }),
      onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.profile(ctx.userId) }),
    }),
    // RF-01.1 verificación del celular: (1) pedir el código SMS (devuelve el desafío) y (2) confirmarlo
    requestPhoneCode: useMutation({
      mutationFn: () => apiRequest<{ challengeId: string; expiresIn: number }>("/auth/phone/code", { method: "POST", token: ctx.token }).then((response) => response.data),
    }),
    verifyPhone: useMutation({
      mutationFn: (input: { challengeId: string; code: string }) => apiRequest("/auth/phone/verify", { method: "POST", token: ctx.token, body: input }),
      onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.profile(ctx.userId) }),
    }),
    // RF-02.6 GDPR portabilidad: descarga la copia de los datos personales como archivo JSON (Blob en memoria)
    exportData: useMutation({
      mutationFn: async () => {
        const { data } = await apiRequest<unknown>(`/user/${ctx.userId}/export`, { token: ctx.token });
        // "Blob" + URL.createObjectURL => descarga local sin otra petición; se libera la memoria después
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
        const link = Object.assign(document.createElement("a"), { href: url, download: `mis-datos-${new Date().toISOString().slice(0, 10)}.json` });
        link.click();
        URL.revokeObjectURL(url);
      },
    }),
    // Baja GDPR: el backend anonimiza los datos y revoca sesiones; aquí se cierra la sesión local
    deleteAccount: useMutation({
      mutationFn: () => userApi.deleteAccount(ctx.token, ctx.userId),
      onSuccess: () => void signOut({ callbackUrl: getPathname({ href: "/", locale }) }), // Home en el idioma actual
    }),
  };
}

export function usePreferences() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.preferences,
    queryFn: () => apiGet<NotificationPreferences>("/notification/preferences", { token: accessToken, cache: "no-store" }),
    enabled: Boolean(accessToken),
  });
  const update = useMutation({
    mutationFn: (changes: Partial<NotificationPreferences>) =>
      apiRequest<NotificationPreferences>("/notification/preferences", { method: "PATCH", token: accessToken, body: changes }).then((response) => response.data),
    onSuccess: (prefs) => queryClient.setQueryData(queryKeys.preferences, prefs),
  });
  return { ...query, update };
}

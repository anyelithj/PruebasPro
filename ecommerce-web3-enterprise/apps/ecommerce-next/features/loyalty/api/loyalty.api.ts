// loyalty.api.ts => cuenta de fidelidad (saldo, nivel, historial) e insignias NFT (listar y mintear).
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiRequest } from "@/shared/lib/api-client";
import { queryKeys } from "@/shared/lib/query-client";
import { useAuth } from "@/shared/hook/useAuth";
import type { LoyaltyAccount, LoyaltyTier, NftBadge } from "@/entities/user/model/user.types";

export function useLoyaltyAccount() {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: queryKeys.loyalty,
    queryFn: () => apiGet<LoyaltyAccount>("/loyalty/me", { token: accessToken, cache: "no-store" }),
    enabled: Boolean(accessToken),
  });
}

export function useBadges(accountId: string | undefined) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: queryKeys.badges(accountId ?? ""),
    queryFn: () => apiGet<NftBadge[]>(`/loyalty/${accountId}/badge`, { token: accessToken, cache: "no-store" }),
    enabled: Boolean(accessToken && accountId),
  });
}

// useMintBadge => POST /loyalty/:id/badge/mint (requiere wallet vinculada; la transacción tarda unos segundos)
export function useMintBadge(accountId: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tier: LoyaltyTier) => apiRequest<NftBadge>(`/loyalty/${accountId}/badge/mint`, { method: "POST", token: accessToken, body: { tier } }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.badges(accountId) }),
  });
}

// ---------- RF-14 logros, ranking, referidos, personal shopper y transferencia de insignias ----------
export interface Achievement {
  code: string;
  name: string;
  points: number;
  unlockedAt: string | null;
}
export interface RankingData {
  top: Array<{ position: number; name: string; tier: LoyaltyTier; lifetimePoints: number }>;
  me: { position: number; lifetimePoints: number } | null;
}

// useLoyaltyGet => lectura autenticada del módulo (DRY para logros, ranking y referido)
function useLoyaltyGet<T>(key: string, path: string) {
  const { accessToken } = useAuth();
  return useQuery({ queryKey: ["loyalty", key], queryFn: () => apiGet<T>(path, { token: accessToken, cache: "no-store" }), enabled: Boolean(accessToken) });
}
export const useAchievements = () => useLoyaltyGet<Achievement[]>("achievements", "/loyalty/me/achievements");
export const useRanking = () => useLoyaltyGet<RankingData>("ranking", "/loyalty/ranking?limit=10");
export const useReferral = () => useLoyaltyGet<{ code: string; points: number }>("referral", "/loyalty/me/referral");

export function usePersonalShopper() {
  const { accessToken } = useAuth();
  return useMutation({ mutationFn: (message: string) => apiRequest("/loyalty/me/personal-shopper", { method: "POST", token: accessToken, body: { message } }) });
}

// useTransferBadge => registra la transferencia YA firmada en la wallet (el backend la verifica en la blockchain)
export function useTransferBadge(accountId: string) {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { badgeId: string; toAddress: string; txHash: string }) =>
      apiRequest<NftBadge>(`/loyalty/${accountId}/badge/${input.badgeId}/transfer`, { method: "POST", token: accessToken, body: { toAddress: input.toAddress, txHash: input.txHash } }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.badges(accountId) }),
  });
}

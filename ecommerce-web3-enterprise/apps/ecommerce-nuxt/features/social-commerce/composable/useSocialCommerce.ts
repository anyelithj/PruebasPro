// useSocialCommerce.ts (Composable + Pinia) => lógica del comercio social sin endpoints extra: agrega las
// publicaciones por influencer (clics, compras) y estima su comisión = compras × precio medio de los productos
// etiquetados × tasa. Funciones PURAS exportadas (testeables) + composable reactivo (Observer sobre el store).
import { computed, type Ref } from "vue";
import type { InfluencerStats, SocialPost } from "~~/entities/social/model/social.types";
import { useSocialStore } from "../model/social.store";

// averagePrice => precio medio (centavos) de los productos de una publicación; 0 si no etiqueta productos
export const averagePrice = (post: SocialPost) => (post.products.length ? Math.round(post.products.reduce((sum, product) => sum + product.minPriceCents, 0) / post.products.length) : 0);

// influencerStats => agrupa por handle y ordena por compras (función pura; "Map" conserva el primer orden visto)
export function influencerStats(posts: SocialPost[], rate: number): InfluencerStats[] {
  const byHandle = new Map<string, InfluencerStats>();
  for (const post of posts) {
    if (!post.influencer) continue;
    const current = byHandle.get(post.influencer.handle) ?? { ...post.influencer, posts: 0, clicks: 0, purchases: 0, commissionCents: 0 };
    current.posts += 1;
    current.clicks += post.metrics.clicks;
    current.purchases += post.metrics.purchases;
    current.commissionCents += Math.round(post.metrics.purchases * averagePrice(post) * rate);
    byHandle.set(post.influencer.handle, current);
  }
  return [...byHandle.values()].sort((a, b) => b.purchases - a.purchases);
}

export function useSocialCommerce(posts: Ref<SocialPost[] | null | undefined>) {
  const store = useSocialStore();
  // computed => se recalcula solo si cambian las publicaciones o la tasa
  const influencers = computed(() => influencerStats(posts.value ?? [], store.commissionRate));
  const filtered = computed(() => (posts.value ?? []).filter((post) => !store.platform || post.platforms.includes(store.platform)));
  return { influencers, filtered, store };
}

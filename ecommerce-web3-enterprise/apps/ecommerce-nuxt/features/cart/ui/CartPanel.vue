<!--
  CartPanel.vue => contenido del carrito: líneas (imagen, variante, cantidad con stepper accesible, quitar), subtotal y
  botón de pago. Lo comparten el panel lateral (CartDrawer) y la página /cart (DRY).
  El pago (checkout con Stripe) sigue en Next.js mientras se migra: el carrito es el mismo (vive en Express).
-->
<script setup lang="ts">
import { computed, ref } from "vue";
import { useCartStore } from "../model/cart.store";
import { useAttribution } from "../model/attribution";
import { useApi } from "~~/shared/lib/api-client";
import { useToast } from "~~/shared/composable/useToast";
import { routes } from "~~/shared/constants/routes";
import { nextAppUrl } from "~~/shared/constants/config";
import { formatMoney } from "~~/shared/lib/format";
import EmptyState from "~~/shared/ui/EmptyState.vue";
import Button from "~~/shared/ui/Button.vue";

const cart = useCartStore();
const toast = useToast();
const { locale } = useI18n();
const localePath = useLocalePath();
const storefront = useRuntimeConfig().public.storefrontUrl;
const money = (cents: number) => formatMoney(cents, cart.cart?.currency ?? "COP", locale.value);
const safely = (action: Promise<void>) => action.catch((error: Error) => toast.error(error.message));
const attribution = useAttribution();
const api = useApi();

// RF-07.3 cupón y puntos: se validan en el checkout (Express) al iniciarlo; aquí se muestra la vista previa del canje
const coupon = ref("");
const points = ref(0);
const maxPoints = computed(() => cart.cart?.loyalty.maxPoints ?? 0);
const pointsValue = computed(() => Math.min(points.value, maxPoints.value) * (cart.cart?.loyalty.pointValueCents ?? 0));
// checkoutUrl => checkout de Next con cupón, puntos y canal (RF-09.7) en la URL (se reserva el stock al llegar)
const checkoutUrl = computed(() => {
  const params = new URLSearchParams();
  if (coupon.value.trim()) params.set("coupon", coupon.value.trim().toUpperCase());
  if (points.value > 0) params.set("points", String(Math.min(points.value, maxPoints.value)));
  if (attribution.value) {
    params.set("channel", attribution.value.channel);
    params.set("ref", attribution.value.ref);
  }
  const query = params.toString();
  return nextAppUrl(storefront, locale.value, `/checkout${query ? `?${query}` : ""}`);
});

// RF-08.1 compra en un clic: dirección y método de pago predeterminados; Express crea el pedido y cobra
const buying = ref(false);
async function oneClick() {
  buying.value = true;
  try {
    const confirmUrl = (id: string) => nextAppUrl(storefront, locale.value, `/checkout/${id}/confirm`);
    // returnUrl con marcador SESSION_ID: Express lo reemplaza por la sesión creada (Stripe vuelve allí tras 3-D Secure)
    const { data } = await api.post<{ checkoutSessionId: string; status: string }>("/payment/one-click", {
      returnUrl: confirmUrl("SESSION_ID"),
      ...(points.value > 0 ? { points: Math.min(points.value, maxPoints.value) } : {}),
      ...(attribution.value ? { channel: attribution.value.channel, channelRef: attribution.value.ref } : {}),
    });
    // Cobro aprobado => confirmación; requiere 3-D Secure => paso de pago de Next (Stripe Elements lo completa)
    window.location.href = data.status === "succeeded" || data.status === "processing" ? confirmUrl(data.checkoutSessionId) : nextAppUrl(storefront, locale.value, `/checkout/${data.checkoutSessionId}/payment`);
  } catch (error) {
    toast.error((error as Error).message);
    buying.value = false;
  }
}
</script>

<template>
  <EmptyState v-if="!cart.cart || cart.cart.items.length === 0" :title="$t('store.cart.emptyTitle')" :description="$t('store.cart.emptyText')">
    <Button :to="localePath(routes.products)" @click="cart.isOpen = false">{{ $t("store.cart.browse") }}</Button>
  </EmptyState>
  <div v-else class="flex flex-col gap-4">
    <ul class="divide-y divide-slate-200">
      <li v-for="item in cart.cart.items" :key="item.id" class="flex gap-3 py-4">
        <img v-if="item.imageUrl" :src="item.imageUrl" alt="" width="80" height="80" class="size-20 shrink-0 rounded-md object-cover" >
        <div class="flex flex-1 flex-col gap-1">
          <NuxtLink :to="localePath(routes.product(item.productSlug))" class="text-sm font-medium text-slate-900 hover:underline" @click="cart.isOpen = false">{{ item.productName }}</NuxtLink>
          <p class="text-xs text-slate-500">{{ item.variantName }} · SKU {{ item.sku }}</p>
          <!-- RF-07.5 avisos: bajó de precio (con el valor anterior) o quedan pocas unidades -->
          <p v-if="item.priceDropped && item.previousUnitPriceCents" class="text-xs font-medium text-emerald-700">{{ $t("store.cart.priceDropped", { before: money(item.previousUnitPriceCents) }) }}</p>
          <p v-else-if="item.priceChanged" class="text-xs text-amber-700">{{ $t("store.cart.priceChanged") }}</p>
          <p v-if="item.lowStock && item.purchasable" class="text-xs font-medium text-orange-700">{{ $t("store.cart.lowStock", { count: item.available }) }}</p>
          <p v-if="!item.purchasable" role="alert" class="text-xs text-red-600">{{ $t("store.cart.unavailable", { count: item.available }) }}</p>
          <div class="mt-1 flex items-center justify-between">
            <div role="group" :aria-label="$t('store.cart.quantityOf', { name: item.productName })" class="flex items-center rounded-md border border-slate-300">
              <button type="button" :aria-label="$t('store.cart.decrease')" :disabled="item.quantity <= 1 || cart.pending" class="size-8 text-lg disabled:opacity-40" @click="safely(cart.update(item.id, item.quantity - 1))">−</button>
              <span aria-live="polite" class="w-8 text-center text-sm">{{ item.quantity }}</span>
              <button type="button" :aria-label="$t('store.cart.increase')" :disabled="item.quantity >= Math.min(item.available, 99) || cart.pending" class="size-8 text-lg disabled:opacity-40" @click="safely(cart.update(item.id, item.quantity + 1))">+</button>
            </div>
            <p class="text-sm font-semibold text-slate-900">{{ money(item.lineTotalCents) }}</p>
          </div>
          <button type="button" class="self-start text-xs text-slate-500 underline hover:text-red-600" :disabled="cart.pending" @click="safely(cart.remove(item.id))">
            {{ $t("store.cart.remove") }} <span class="sr-only">{{ item.productName }}</span>
          </button>
        </div>
      </li>
    </ul>
    <section class="flex flex-col gap-3 rounded-lg bg-slate-50 p-4">
      <p class="flex justify-between text-sm"><span>{{ $t("store.cart.subtotal", { count: cart.cart.itemCount }) }}</span><span class="font-semibold">{{ money(cart.cart.subtotalCents) }}</span></p>
      <!-- RF-07.3 cupón y puntos de fidelidad (la validación final la hace el checkout) -->
      <label class="flex flex-col gap-1 text-sm">
        <span>{{ $t("store.cart.coupon") }}</span>
        <input v-model="coupon" type="text" autocomplete="off" maxlength="40" class="h-9 rounded-md border border-slate-300 px-3 uppercase focus:outline-none focus:ring-2 focus:ring-accent" >
      </label>
      <label v-if="maxPoints > 0" class="flex flex-col gap-1 text-sm">
        <span>{{ $t("store.cart.points", { balance: cart.cart.loyalty.balance, max: maxPoints }) }}</span>
        <input v-model.number="points" type="number" min="0" :max="maxPoints" step="1" class="h-9 rounded-md border border-slate-300 px-3 focus:outline-none focus:ring-2 focus:ring-accent" >
        <span v-if="pointsValue > 0" class="text-xs text-emerald-700">{{ $t("store.cart.pointsValue", { value: money(pointsValue) }) }}</span>
      </label>
      <p class="text-xs text-slate-500">{{ $t("store.cart.shippingNote") }}</p>
      <a :href="checkoutUrl" :aria-disabled="cart.cart.items.some((item) => !item.purchasable) || undefined" class="flex h-12 items-center justify-center rounded-md bg-brand font-medium text-brand-foreground hover:bg-slate-800 aria-disabled:pointer-events-none aria-disabled:opacity-50">{{ $t("store.cart.checkout") }}</a>
      <!-- RF-08.1 un clic: usa la dirección y el método de pago predeterminados de la cuenta -->
      <Button variant="secondary" :loading="buying" :disabled="cart.cart.items.some((item) => !item.purchasable)" @click="oneClick">{{ $t("store.cart.oneClick") }}</Button>
    </section>
  </div>
</template>

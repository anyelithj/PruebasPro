<!--
  ProductBuyBox.vue => precio, selector de variantes por atributo (talla, color), cantidad y "Agregar al carrito".
  Los atributos se derivan de las variantes: una opción sin combinación con stock queda deshabilitada (nunca se
  elige una variante inexistente). Radios nativos: navegables con flechas del teclado.
-->
<script setup lang="ts">
import { computed, ref } from "vue";
import { discountPercent, type ProductDetail, type ProductVariant } from "~~/entities/product/model/product.types";
import { useCartStore } from "~~/features/cart/model/cart.store";
import { useAuth } from "~~/shared/composable/useAuth";
import { useToast } from "~~/shared/composable/useToast";
import { storeLoginUrl } from "~~/shared/constants/config";
import { formatMoney } from "~~/shared/lib/format";
import Button from "~~/shared/ui/Button.vue";

const props = defineProps<{ product: ProductDetail }>();
const { t, locale } = useI18n();
const { isAuthenticated } = useAuth();
const cart = useCartStore();
const toast = useToast();
const config = useRuntimeConfig().public;

const matches = (variant: ProductVariant, selection: Record<string, string>) => Object.entries(selection).every(([key, value]) => variant.attributes[key] === value);

// attributes => { name: "size", values: ["38", "40"] } derivados de las variantes activas
const variants = computed(() => props.product.variants.filter((variant) => variant.isActive));
const attributes = computed(() => {
  const map = new Map<string, Set<string>>();
  for (const variant of variants.value) for (const [key, value] of Object.entries(variant.attributes)) map.set(key, (map.get(key) ?? new Set()).add(value));
  return [...map.entries()].map(([name, values]) => ({ name, values: [...values] }));
});

// Selección inicial: la primera variante con stock (o la primera si todas están agotadas)
const selection = ref<Record<string, string>>({ ...((variants.value.find((variant) => variant.available > 0) ?? variants.value[0])?.attributes ?? {}) });
const quantity = ref(1);
const selected = computed(() => variants.value.find((variant) => matches(variant, selection.value)) ?? null);
const price = computed(() => selected.value?.priceCents ?? props.product.minPriceCents);
const discount = computed(() => discountPercent(price.value, selected.value?.compareAtPriceCents));
const maxQuantity = computed(() => Math.max(1, Math.min(10, selected.value?.available ?? 1)));
const money = (cents: number) => formatMoney(cents, props.product.currency, locale.value);
const hasStock = (name: string, value: string) => variants.value.some((variant) => matches(variant, { ...selection.value, [name]: value }) && variant.available > 0);

async function addToCart() {
  // El carrito es por usuario: sin sesión se va al login único (Next.js)
  if (!isAuthenticated.value) return navigateTo(storeLoginUrl(config.storefrontUrl, locale.value), { external: true });
  if (!selected.value) return;
  try {
    await cart.add(selected.value.id, quantity.value);
    toast.success(t("store.product.added", { name: props.product.name }));
    cart.isOpen = true; // Abre el carrito como confirmación visual
  } catch (error) {
    toast.error((error as Error).message);
  }
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <p class="flex items-baseline gap-3">
      <span class="text-2xl font-semibold text-slate-900">{{ money(price) }}</span>
      <template v-if="discount && selected?.compareAtPriceCents">
        <span class="text-slate-500 line-through">{{ money(selected.compareAtPriceCents) }}</span>
        <span class="text-sm font-medium text-red-700">-{{ discount }}%</span>
      </template>
    </p>

    <fieldset v-for="attribute in attributes" :key="attribute.name">
      <legend class="mb-2 text-sm font-medium capitalize text-slate-700">{{ attribute.name }}: <span class="font-normal">{{ selection[attribute.name] }}</span></legend>
      <div class="flex flex-wrap gap-2">
        <label v-for="value in attribute.values" :key="value" :class="['cursor-pointer rounded-md border px-4 py-2 text-sm has-[:checked]:border-slate-900 has-[:checked]:bg-slate-900 has-[:checked]:text-slate-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent', !hasStock(attribute.name, value) && 'cursor-not-allowed line-through opacity-40']">
          <input v-model="selection[attribute.name]" type="radio" :name="attribute.name" :value="value" class="sr-only" :disabled="!hasStock(attribute.name, value)" >
          {{ value }}
        </label>
      </div>
    </fieldset>

    <div class="flex items-end gap-3">
      <label class="flex flex-col gap-1 text-sm font-medium text-slate-700">
        {{ $t("store.product.quantity") }}
        <select v-model.number="quantity" class="h-12 rounded-md border border-slate-300 px-3 text-sm">
          <option v-for="value in maxQuantity" :key="value" :value="value">{{ value }}</option>
        </select>
      </label>
      <p aria-live="polite" class="pb-3 text-sm text-slate-600">
        {{ !selected ? $t("store.product.unavailable") : selected.available > 0 ? $t("store.product.available", { count: selected.available }) : $t("store.product.soldOut") }}
      </p>
    </div>

    <Button class="h-12 w-full text-base" :loading="cart.pending" :disabled="!selected || selected.available === 0" @click="addToCart">
      {{ selected && selected.available === 0 ? $t("store.product.soldOut") : $t("store.product.addToCart") }}
    </Button>
  </div>
</template>

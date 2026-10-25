<!--
  [Atomic Design: Molecule — input validado de dirección cripto (Solana Base58 | ETH 0x).]
  [SOLID/SRP: solo captura+valida una dirección. DRY: valida con el schema Zod compartido.]
  [Facade: envuelve AppInput; emite update:modelValue + valid para el organismo.]
  [a11y: hereda label/aria-invalid/aria-describedby de AppInput.]
-->
<script setup lang="ts">
import { computed, watch } from 'vue';
import AppInput from '~/components/atoms/AppInput.vue';
import { solanaAddressSchema } from '~/shared/schemas/blockchain-solana.schema';
import { ethereumAddressSchema } from '~/shared/schemas/blockchain-ethereum.schema';
import type { Chain } from '~/composables/useBlockchain';

const props = withDefaults(
  defineProps<{ chain: Chain; modelValue: string; optional?: boolean }>(),
  { optional: true },
);
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'valid', isValid: boolean): void;
}>();

const schema = computed(() =>
  props.chain === 'solana' ? solanaAddressSchema : ethereumAddressSchema,
);
const placeholder = computed(() =>
  props.chain === 'solana' ? 'Ej: 7xKX…9aBc (Base58)' : 'Ej: 0x1234…abCD',
);

// Error solo cuando hay texto (vacío es válido si optional).
const error = computed(() => {
  if (!props.modelValue) return props.optional ? '' : 'Dirección requerida';
  return schema.value.safeParse(props.modelValue).success ? '' : `Dirección ${props.chain} inválida`;
});

// Notifica validez al organismo (para habilitar/deshabilitar acciones).
watch(
  () => [props.modelValue, props.chain] as const,
  () => {
    const isValid = props.modelValue
      ? schema.value.safeParse(props.modelValue).success
      : props.optional;
    emit('valid', isValid);
  },
  { immediate: true },
);
</script>

<template>
  <AppInput
    id="wallet-input"
    :label="`Wallet ${chain === 'solana' ? 'Solana' : 'Ethereum'} (opcional)`"
    :model-value="modelValue"
    :placeholder="placeholder"
    :error="error"
    autocomplete="off"
    @update:model-value="emit('update:modelValue', $event)"
  />
</template>

<!--
  ShippingCarrierForm.vue (Vue 3 + Vee-Validate + Zod) => transportadoras: código, nombre, activa, tarifa base, valor
  por kg y días estimados (lista dinámica) + envío gratis desde un monto. Montos en pesos en el formulario y en
  centavos en Express (Adapter toShipping). Responsive: cada transportadora es una tarjeta en móvil.
-->
<script setup lang="ts">
import { useFieldArray, useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import type { ShippingConfig } from "~~/entities/pwa/model/pwa.types";
import Input from "~~/shared/ui/Input.vue";
import Button from "~~/shared/ui/Button.vue";
import ActionButton from "~~/shared/ui/ActionButton.vue"; // Acción de fila solo con ícono (ancho uniforme)
import { shippingSchema, toShipping } from "../lib/config.validator";

const props = defineProps<{ value: ShippingConfig }>();
const emit = defineEmits<{ save: [value: Record<string, unknown>] }>();
const toPesos = (cents: number) => cents / 100;

const { handleSubmit, isSubmitting } = useForm({
  validationSchema: toTypedSchema(shippingSchema),
  initialValues: {
    carriers: props.value.carriers.map((carrier) => ({ code: carrier.code, name: carrier.name, enabled: carrier.enabled, base: toPesos(carrier.baseCents), perKg: toPesos(carrier.perKgCents), etaDays: carrier.etaDays, phone: carrier.phone ?? "", trackingUrl: carrier.trackingUrl ?? "" })),
    freeShippingOver: props.value.freeShippingOverCents === null ? "" : toPesos(props.value.freeShippingOverCents),
    pickupEnabled: props.value.storePickup?.enabled ?? false,
    pickupAddress: props.value.storePickup?.address ?? "",
  },
});
const { fields, push, remove } = useFieldArray("carriers");
const submit = handleSubmit((form) => emit("save", toShipping(form)));
</script>

<template>
  <form class="flex flex-col gap-5" novalidate @submit.prevent="submit">
    <fieldset v-for="(field, index) in fields" :key="field.key" class="grid grid-cols-1 gap-3 rounded-lg border bg-white p-4 sm:grid-cols-3">
      <legend class="px-1 text-sm font-semibold">{{ $t("config.shipping.carrier", { n: index + 1 }) }}</legend>
      <Input :name="`carriers[${index}].code`" :label="$t('config.shipping.code')" />
      <Input :name="`carriers[${index}].name`" :label="$t('config.shipping.name')" />
      <Input :name="`carriers[${index}].etaDays`" type="number" :label="$t('config.shipping.eta')" />
      <Input :name="`carriers[${index}].base`" type="number" :label="$t('config.shipping.base')" />
      <Input :name="`carriers[${index}].perKg`" type="number" :label="$t('config.shipping.perKg')" />
      <Input :name="`carriers[${index}].phone`" type="tel" :label="$t('config.shipping.phone')" />
      <div class="sm:col-span-2"><Input :name="`carriers[${index}].trackingUrl`" type="url" :label="$t('config.shipping.trackingUrl')" :hint="$t('config.shipping.trackingHint')" /></div>
      <div class="flex items-end justify-between gap-2">
        <Input :name="`carriers[${index}].enabled`" as="checkbox" :label="$t('config.shipping.enabled')" />
        <ActionButton icon="delete" :label="$t('common.delete')" @click="remove(index)" />
      </div>
    </fieldset>
    <Button variant="secondary" size="sm" class="self-start" :disabled="fields.length >= 10" @click="push({ code: '', name: '', enabled: true, base: 0, perKg: 0, etaDays: 3, phone: '', trackingUrl: '' })">{{ $t("common.new") }}</Button>
    <Input name="freeShippingOver" type="number" :label="$t('config.shipping.free')" :hint="$t('config.shipping.freeHint')" />
    <!-- RF-08.2 recogida en tienda (aparece como opción de envío gratis en el checkout) -->
    <fieldset class="flex flex-col gap-3 rounded-lg border bg-white p-4">
      <legend class="px-1 text-sm font-semibold">{{ $t("config.shipping.pickup") }}</legend>
      <Input name="pickupEnabled" as="checkbox" :label="$t('config.shipping.pickupEnabled')" />
      <Input name="pickupAddress" :label="$t('config.shipping.pickupAddress')" />
    </fieldset>
    <Button type="submit" class="self-end" :loading="isSubmitting">{{ $t("common.save") }}</Button>
  </form>
</template>

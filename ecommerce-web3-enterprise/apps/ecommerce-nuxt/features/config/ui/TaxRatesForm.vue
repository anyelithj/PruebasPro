<!--
  TaxRatesForm.vue (Vue 3 + Vee-Validate + Zod) => impuestos: si los precios ya incluyen IVA y tasas por región
  (en % en el formulario, fracción en Express: Adapter toTax). Lista dinámica con useFieldArray.
-->
<script setup lang="ts">
import { useFieldArray, useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import type { TaxConfig } from "~~/entities/pwa/model/pwa.types";
import Input from "~~/shared/ui/Input.vue";
import Button from "~~/shared/ui/Button.vue";
import ActionButton from "~~/shared/ui/ActionButton.vue"; // Acción de fila solo con ícono (ancho uniforme)
import { taxSchema, toTax } from "../lib/config.validator";

const props = defineProps<{ value: TaxConfig }>();
const emit = defineEmits<{ save: [value: Record<string, unknown>] }>();
const { handleSubmit, isSubmitting } = useForm({
  validationSchema: toTypedSchema(taxSchema),
  initialValues: { pricesIncludeTax: props.value.pricesIncludeTax, rates: props.value.rates.map((rate) => ({ region: rate.region, percent: Math.round(rate.rate * 10000) / 100 })) },
});
const { fields, push, remove } = useFieldArray("rates");
const submit = handleSubmit((form) => emit("save", toTax(form)));
</script>

<template>
  <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
    <Input name="pricesIncludeTax" as="checkbox" :label="$t('config.tax.included')" />
    <div v-for="(field, index) in fields" :key="field.key" class="grid grid-cols-[1fr_120px_auto] items-end gap-2">
      <Input :name="`rates[${index}].region`" :label="$t('config.tax.region')" />
      <Input :name="`rates[${index}].percent`" type="number" :label="$t('config.tax.percent')" />
      <ActionButton icon="delete" :label="$t('common.delete')" @click="remove(index)" />
    </div>
    <Button variant="secondary" size="sm" class="self-start" @click="push({ region: '', percent: 19 })">{{ $t("common.new") }}</Button>
    <Button type="submit" class="self-end" :loading="isSubmitting">{{ $t("common.save") }}</Button>
  </form>
</template>

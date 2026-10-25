<!--
  StoreCurrencyForm.vue (Vue 3 + Vee-Validate + Zod) => moneda por defecto y monedas aceptadas (códigos ISO 4217
  separados por comas; Zod los normaliza a mayúsculas y quita repetidos).
-->
<script setup lang="ts">
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import type { CurrencyConfig } from "~~/entities/pwa/model/pwa.types";
import Input from "~~/shared/ui/Input.vue";
import Button from "~~/shared/ui/Button.vue";
import { currencySchema } from "../lib/config.validator";

const props = defineProps<{ value: CurrencyConfig }>();
const emit = defineEmits<{ save: [value: Record<string, unknown>] }>();
const { handleSubmit, isSubmitting } = useForm({ validationSchema: toTypedSchema(currencySchema), initialValues: { default: props.value.default, supported: props.value.supported.join(", ") } });
const submit = handleSubmit((form) => emit("save", form));
</script>

<template>
  <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
    <Input name="default" :label="$t('config.currency.default')" :hint="$t('config.currency.iso')" />
    <Input name="supported" :label="$t('config.currency.supported')" :hint="$t('config.currency.supportedHint')" />
    <Button type="submit" class="self-end" :loading="isSubmitting">{{ $t("common.save") }}</Button>
  </form>
</template>

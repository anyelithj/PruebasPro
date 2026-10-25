<!--
  ReturnsPolicyForm.vue (Vue 3 + Vee-Validate + Zod) => RF-12.6 política de devoluciones configurable: días de plazo
  desde la entrega y si las fotos del producto son obligatorias (Express las aplica al solicitar la devolución).
-->
<script setup lang="ts">
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import type { ReturnsConfig } from "~~/entities/pwa/model/pwa.types";
import Input from "~~/shared/ui/Input.vue";
import Button from "~~/shared/ui/Button.vue";
import { returnsSchema } from "../lib/config.validator";

const props = defineProps<{ value: ReturnsConfig }>();
const emit = defineEmits<{ save: [value: Record<string, unknown>] }>();
const { handleSubmit, isSubmitting } = useForm({ validationSchema: toTypedSchema(returnsSchema), initialValues: { ...props.value } });
const submit = handleSubmit((form) => emit("save", form));
</script>

<template>
  <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
    <Input name="windowDays" type="number" :label="$t('config.returns.windowDays')" class="max-w-40" />
    <Input name="requirePhotos" as="checkbox" :label="$t('config.returns.requirePhotos')" />
    <Button type="submit" class="self-end" :loading="isSubmitting">{{ $t("common.save") }}</Button>
  </form>
</template>

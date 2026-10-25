<!--
  HelpCenterForm.vue (Vue 3 + Vee-Validate + Zod) => RF-21.2 configuración del centro de ayuda: preguntas frecuentes
  por categoría (lista dinámica con useFieldArray) y datos de contacto visibles en /help.
-->
<script setup lang="ts">
import { useFieldArray, useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import Input from "~~/shared/ui/Input.vue";
import Button from "~~/shared/ui/Button.vue";
import ActionButton from "~~/shared/ui/ActionButton.vue";
import { helpSchema, type HelpConfig } from "~~/features/store/lib/help.validator";

const props = defineProps<{ value: HelpConfig }>();
const emit = defineEmits<{ save: [value: Record<string, unknown>] }>();
const { handleSubmit, isSubmitting } = useForm({
  validationSchema: toTypedSchema(helpSchema),
  initialValues: { faq: props.value.faq.map((item) => ({ ...item })), contactEmail: props.value.contactEmail ?? "", whatsapp: props.value.whatsapp ?? "", hours: props.value.hours ?? "" },
});
const { fields, push, remove } = useFieldArray("faq");
const submit = handleSubmit((form) => emit("save", form));
</script>

<template>
  <form class="flex flex-col gap-4" novalidate @submit.prevent="submit">
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Input name="contactEmail" type="email" :label="$t('config.help.contactEmail')" />
      <Input name="whatsapp" type="tel" :label="$t('config.help.whatsapp')" />
      <Input name="hours" :label="$t('config.help.hours')" />
    </div>
    <fieldset v-for="(field, index) in fields" :key="field.key" class="grid grid-cols-1 items-end gap-2 rounded-lg border p-3 sm:grid-cols-[160px_1fr_auto]">
      <legend class="sr-only">{{ $t("config.help.question") }} {{ index + 1 }}</legend>
      <Input :name="`faq[${index}].category`" :label="$t('config.help.category')" />
      <Input :name="`faq[${index}].question`" :label="$t('config.help.question')" />
      <ActionButton icon="delete" :label="$t('common.delete')" @click="remove(index)" />
      <div class="sm:col-span-3"><Input :name="`faq[${index}].answer`" as="textarea" :rows="3" :label="$t('config.help.answer')" /></div>
    </fieldset>
    <Button variant="secondary" size="sm" class="self-start" @click="push({ category: '', question: '', answer: '' })">{{ $t("common.new") }}</Button>
    <Button type="submit" class="self-end" :loading="isSubmitting">{{ $t("common.save") }}</Button>
  </form>
</template>

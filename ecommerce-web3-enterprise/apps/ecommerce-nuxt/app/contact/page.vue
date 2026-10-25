<!--
  page.vue (/contact) => RF-21.2 formulario de contacto (sin cuenta): nombre, correo, teléfono, tema, número de pedido y
  mensaje. Express guarda el mensaje, avisa al equipo y envía acuse de recibo. Anti-spam: honeypot invisible + límite
  por IP en Express. Patrón Factory (Vee-Validate + Zod). Accesibilidad: <label> en cada campo, errores asociados,
  confirmación con role="status" y el honeypot fuera del árbol de accesibilidad (aria-hidden + tabindex -1).
-->
<script setup lang="ts">
import { ref } from "vue";
import { useField, useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import Input from "~~/shared/ui/Input.vue";
import Button from "~~/shared/ui/Button.vue";
import { useApi } from "~~/shared/lib/api-client";
import { useToast } from "~~/shared/composable/useToast";
import { routes } from "~~/shared/constants/routes";
import { CONTACT_TOPICS, contactSchema } from "~~/features/store/lib/help.validator";

const { t } = useI18n();
const toast = useToast();
const route = useRoute();
const localePath = useLocalePath();
const api = useApi();
const sent = ref(false);
const { handleSubmit, isSubmitting, resetForm } = useForm({
  validationSchema: toTypedSchema(contactSchema),
  // ?topic=ORDER&order=ORD-... => la ayuda o la cuenta pueden abrir el formulario ya prellenado
  initialValues: { name: "", email: "", phone: "", topic: (CONTACT_TOPICS as readonly string[]).includes(String(route.query["topic"])) ? (route.query["topic"] as (typeof CONTACT_TOPICS)[number]) : "OTHER", orderNumber: typeof route.query["order"] === "string" ? route.query["order"] : "", message: "", website: "" },
});
const { value: website } = useField<string>("website"); // Honeypot registrado en el formulario
const submit = handleSubmit(async (values) => {
  try {
    await api.post("/communication/contact", values);
    sent.value = true;
    resetForm();
  } catch (error) {
    toast.error((error as Error).message);
  }
});
useSeoMeta({ title: () => t("store.contact.title"), description: () => t("store.contact.subtitle") });
</script>

<template>
  <div class="mx-auto flex max-w-xl flex-col gap-6">
    <header>
      <h1 class="text-3xl font-semibold">{{ $t("store.contact.title") }}</h1>
      <p class="text-slate-600">{{ $t("store.contact.subtitle") }} <NuxtLink :to="localePath(routes.help)" class="underline">{{ $t("store.contact.seeFaq") }}</NuxtLink></p>
    </header>
    <p v-if="sent" role="status" class="rounded-lg bg-emerald-50 p-4 text-emerald-900">{{ $t("store.contact.sent") }}</p>
    <form v-else class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input name="name" :label="$t('store.contact.name')" />
        <Input name="email" type="email" :label="$t('store.contact.email')" />
        <Input name="phone" type="tel" :label="$t('store.contact.phone')" />
        <Input name="topic" as="select" :label="$t('store.contact.topic')" :options="CONTACT_TOPICS.map((value) => ({ value, label: $t(`store.contact.topics.${value}`) }))" />
      </div>
      <Input name="orderNumber" :label="$t('store.contact.orderNumber')" :hint="$t('store.contact.orderHint')" />
      <Input name="message" as="textarea" :rows="6" :label="$t('store.contact.message')" />
      <!-- Honeypot: invisible para personas y lectores de pantalla; los bots lo llenan y Express descarta el envío -->
      <div aria-hidden="true" class="absolute -left-[9999px]"><label>Website <input v-model="website" name="website" tabindex="-1" autocomplete="off"></label></div>
      <Button type="submit" :loading="isSubmitting" class="self-start">{{ $t("store.contact.send") }}</Button>
    </form>
  </div>
</template>

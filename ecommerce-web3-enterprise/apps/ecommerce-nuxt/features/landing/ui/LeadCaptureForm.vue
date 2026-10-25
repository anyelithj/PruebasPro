<!--
  LeadCaptureForm.vue (Vue 3 + Vee-Validate + Zod) => suscripción a una landing: email, nombre opcional y
  consentimiento explícito. Envía el origen de la visita (utm guardado por el middleware "analytics") para atribuir
  el lead a su campaña. Si el email ya estaba suscrito se informa sin error (idempotente para el usuario).
  Patrón Factory (formulario a partir del schema) + Observer (estado en el store de la landing).
-->
<script setup lang="ts">
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import { useApi, toApiError } from "~~/shared/lib/api-client";
import { useToast } from "~~/shared/composable/useToast";
import { track } from "~~/shared/lib/analytics";
import Input from "~~/shared/ui/Input.vue";
import Button from "~~/shared/ui/Button.vue";
import { landingApi } from "../api/landing.api";
import { leadSchema } from "../lib/landing.validator";
import { useLandingStore } from "../model/landing.store";

const props = defineProps<{ slug: string }>();
const { t } = useI18n();
const toast = useToast();
const store = useLandingStore();
const api = landingApi(useApi());
const { handleSubmit, isSubmitting } = useForm({ validationSchema: toTypedSchema(leadSchema), initialValues: { email: "", name: "", consent: false as unknown as true } });

// source => origen guardado por el middleware analytics (sessionStorage)
const source = () => {
  try {
    return sessionStorage.getItem("nuxt-lead-source") ?? undefined;
  } catch {
    return undefined;
  }
};

const submit = handleSubmit(async (values) => {
  try {
    await api.subscribe(props.slug, { ...values, source: source() });
    track("click", { metadata: { landing: props.slug, lead: true } });
    store.markSubscribed(props.slug);
  } catch (error) {
    const failure = toApiError(error);
    if (failure.code === "LEAD_ALREADY_EXISTS") return store.markSubscribed(props.slug); // Ya estaba: se muestra el agradecimiento
    toast.error(failure.status === 429 ? t("landing.tooMany") : t("landing.leadError"));
  }
});
</script>

<template>
  <section class="rounded-xl border bg-white p-6 shadow-sm" aria-labelledby="lead-title">
    <h2 id="lead-title" class="text-xl font-semibold">{{ $t("landing.leadTitle") }}</h2>
    <p v-if="store.isSubscribed(slug)" role="status" class="mt-3 rounded-md bg-green-50 p-3 text-sm text-green-800">{{ $t("landing.thanks") }}</p>
    <form v-else class="mt-4 flex flex-col gap-4" novalidate @submit.prevent="submit">
      <Input name="email" type="email" :label="$t('landing.email')" />
      <Input name="name" :label="$t('landing.name')" />
      <Input name="consent" as="checkbox" :label="$t('landing.consent')" />
      <Button type="submit" :loading="isSubmitting">{{ $t("landing.subscribe") }}</Button>
    </form>
  </section>
</template>

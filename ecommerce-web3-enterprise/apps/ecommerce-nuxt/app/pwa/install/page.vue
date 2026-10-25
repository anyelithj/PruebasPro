<!--
  page.vue (/pwa/install) => cómo instalar la app: botón nativo si el navegador lo permite y pasos manuales para
  iOS/Safari (que no emite "beforeinstallprompt"). Layout "blank", solo navegador.
-->
<script setup lang="ts">
import InstallPrompt from "~~/features/pwa/ui/InstallPrompt.vue";

definePageMeta({ layout: "blank" });
const { t } = useI18n();
useSeoMeta({ title: () => t("pwa.install.title") });
</script>

<template>
  <div class="flex flex-col gap-6">
    <h1 class="text-2xl font-semibold">{{ $t("pwa.install.title") }}</h1>
    <InstallPrompt variant="card" />
    <section aria-labelledby="ios-title" class="flex flex-col gap-2 text-sm text-slate-700">
      <h2 id="ios-title" class="font-semibold">{{ $t("pwa.install.iosTitle") }}</h2>
      <ol class="ml-5 list-decimal">
        <li>{{ $t("pwa.install.ios1") }}</li>
        <li>{{ $t("pwa.install.ios2") }}</li>
      </ol>
    </section>
  </div>
</template>

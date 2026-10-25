<!--
  page.vue (/login) => el login es ÚNICO y vive en Next.js (SSO, ver server/middleware/auth.ts). Esta ruta solo
  redirige allá (enlaces y marcadores viejos); tras entrar, Next lleva al panel admin (/dashboard).
-->
<script setup lang="ts">
import { storeLoginUrl } from "~~/shared/constants/config";

definePageMeta({ layout: "blank" });
const { locale } = useI18n();
await navigateTo(storeLoginUrl(useRuntimeConfig().public.storefrontUrl, locale.value), { external: true });
</script>

<template>
  <p class="text-sm text-slate-600">…</p>
</template>

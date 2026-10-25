<!--
  page.vue (/pwa/notifications) => activar/desactivar notificaciones push en este dispositivo (Guard: requiere sesión
  porque la suscripción se asocia al usuario en Express). Explica qué se recibe y que se puede desactivar.
-->
<script setup lang="ts">
import AdminHeading from "~~/shared/ui/AdminHeading.vue"; // Título + descripción desde el manifiesto del menú (igual que Next)
import PushToggle from "~~/features/pwa/ui/PushToggle.vue";

definePageMeta({ layout: "admin", middleware: ["auth"] });
</script>

<template>
  <div class="flex flex-col gap-6">
    <AdminHeading nav-key="notifications" />
    <section class="flex max-w-xl flex-col gap-4 rounded-xl border bg-white p-6">
      <p class="text-sm text-slate-600">{{ $t("pwa.push.description") }}</p>
      <PushToggle />
    </section>
  </div>
</template>

<!--
  page.vue (/pwa/cache) => gestor de caché del Service Worker (Guard ADMIN): ver cachés, estrategia, uso del
  almacenamiento y liberar espacio. Útil para soporte (forzar contenido fresco en un dispositivo).
-->
<script setup lang="ts">
import AdminHeading from "~~/shared/ui/AdminHeading.vue"; // Título + descripción desde el manifiesto del menú (igual que Next)
import CacheStatus from "~~/features/pwa/ui/CacheStatus.vue";

definePageMeta({ layout: "admin", middleware: ["auth", "rbac"], roles: ["ADMIN"] });
</script>

<template>
  <div class="flex flex-col gap-6">
    <AdminHeading nav-key="offline" />
    <CacheStatus />
  </div>
</template>

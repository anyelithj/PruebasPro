<!--
  PWAStatusBar.vue (widget, Composite) => pila de avisos de la PWA fija abajo a la izquierda: sin conexión, nueva
  versión e instalación. Se monta una vez en app.vue (solo cliente). Cada aviso decide si se muestra (SRP).
-->
<script setup lang="ts">
import OfflineIndicator from "~~/features/pwa/ui/OfflineIndicator.vue";
import UpdateBanner from "~~/features/pwa/ui/UpdateBanner.vue";
import InstallPrompt from "~~/features/pwa/ui/InstallPrompt.vue";
</script>

<template>
  <div class="fixed bottom-4 left-4 z-40 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
    <OfflineIndicator />
    <UpdateBanner />
    <InstallPrompt />
  </div>
</template>

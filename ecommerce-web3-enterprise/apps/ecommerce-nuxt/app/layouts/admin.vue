<!--
  admin.vue (layout de Nuxt, HOC) => MISMO marco que PanelFrame.tsx de Next.js: loader superior + menú lateral fijo
  (oscuro, plegable) + barra superior + contenido. Las páginas declaran middleware ["auth", "rbac"] (patrón Guard);
  aquí solo se compone la estructura (SRP). SEO: noindex (zona privada). Responsive: el menú pasa a panel deslizable.
-->
<script setup lang="ts">
import AdminHeader from "~~/widgets/navigation/AdminHeader.vue";
import AdminSidebar from "~~/widgets/navigation/AdminSidebar.vue";
import TopLoader from "~~/widgets/navigation/TopLoader.vue";
import { usePanelNav } from "~~/widgets/navigation/usePanelNav";

const { collapsed, text } = usePanelNav();
useSeoMeta({ robots: "noindex, nofollow" });
</script>

<template>
  <div class="min-h-screen bg-slate-50">
    <TopLoader :label="text('loading')" />
    <AdminSidebar />
    <!-- Columna de contenido: deja espacio al menú fijo (ancho completo o riel), igual que Next -->
    <div :class="['flex min-h-screen flex-col transition-[padding] duration-200 motion-reduce:transition-none', collapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-72']">
      <AdminHeader />
      <main id="main-content" class="mx-auto flex w-full min-w-0 max-w-[1400px] flex-1 flex-col gap-6 p-4 lg:p-6"><slot /></main>
    </div>
  </div>
</template>

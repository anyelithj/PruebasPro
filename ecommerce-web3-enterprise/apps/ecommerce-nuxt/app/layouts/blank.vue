<!--
  blank.vue (layout de Nuxt) => sin cabecera ni pie: login, instalación de la PWA y página sin conexión
  (la página offline debe funcionar aunque no cargue nada más).
-->
<template>
  <main id="main-content" class="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10"><slot /></main>
</template>

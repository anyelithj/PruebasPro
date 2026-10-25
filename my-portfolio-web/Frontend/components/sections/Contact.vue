<!--
  [Atomic Design: Facade — delega al organism ContactSection.]
-->
<script setup lang="ts">
import ContactSection from '~/components/organisms/ContactSection.vue'
</script>

<template>
  <ContactSection v-bind="$attrs" />
</template>

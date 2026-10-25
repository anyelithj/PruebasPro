<!--
  [Atomic Design: Facade — delega al organism SocialLinksSection.]
  [Bug-fix de alineación: encapsulado dentro de SocialIconButton (caja 48x48 fija).]
-->
<script setup lang="ts">
import SocialLinksSection from '~/components/organisms/SocialLinksSection.vue'
</script>

<template>
  <SocialLinksSection v-bind="$attrs" />
</template>

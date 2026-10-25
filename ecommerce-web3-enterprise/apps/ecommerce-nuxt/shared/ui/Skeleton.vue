<!--
  Skeleton.vue => marcador de carga con el tamaño final del contenido (evita saltos de diseño: CLS). aria-hidden:
  el estado de carga lo anuncia el contenedor (aria-busy). La animación se desactiva con "reducir movimiento".
-->
<template>
  <div class="animate-pulse rounded-md bg-slate-200 motion-reduce:animate-none" aria-hidden="true" />
</template>

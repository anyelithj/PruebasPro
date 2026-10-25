<!-- [MVC-V] estado de los backends — consume el BFF /api/health que pinguea Nest + FastAPI. -->
<script setup lang="ts">
import { useAsyncData } from '#app';

interface Ping {
  up: boolean;
  detail?: unknown;
}
interface HealthData {
  nest: Ping;
  fastapi: Ping;
}

const { data, pending, refresh } = useAsyncData<{ data: HealthData }>('api-health', () =>
  $fetch('/api/health'),
);
</script>

<template>
  <section class="status">
    <h1>Estado de los backends</h1>
    <button class="status__refresh" :disabled="pending" @click="() => refresh()">
      {{ pending ? 'Comprobando…' : 'Refrescar' }}
    </button>

    <ul v-if="data?.data" class="status__list">
      <li class="status__item">
        <span class="status__name">NestJS</span>
        <span :class="['status__dot', data.data.nest.up ? 'up' : 'down']" />
        <span>{{ data.data.nest.up ? 'online' : 'offline' }}</span>
      </li>
      <li class="status__item">
        <span class="status__name">FastAPI</span>
        <span :class="['status__dot', data.data.fastapi.up ? 'up' : 'down']" />
        <span>{{ data.data.fastapi.up ? 'online' : 'offline' }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.status {
  max-width: 30rem;
  margin: 4rem auto;
  padding: 0 1.5rem;
}
.status__refresh {
  margin: 1rem 0;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: transparent;
  cursor: pointer;
}
.status__list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.status__item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.status__name {
  width: 6rem;
  font-weight: 600;
}
.status__dot {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 50%;
}
.status__dot.up {
  background: #16a34a;
}
.status__dot.down {
  background: #dc2626;
}
</style>

<!-- [ATOMIC-A][SRP] notificación autocontenida — renderiza el estado global de useToast. -->
<script setup lang="ts">
import { useToast } from '~/composables/useToast';

const { toasts, dismiss } = useToast();
</script>

<template>
  <Teleport to="body">
    <div class="toast-stack" aria-live="polite">
      <div
        v-for="t in toasts"
        :key="t.id"
        :class="['toast', `toast--${t.type}`]"
        role="status"
        @click="dismiss(t.id)"
      >
        {{ t.message }}
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-stack {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 22rem;
}
.toast {
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  color: white;
  font-size: 0.85rem;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
}
.toast--success {
  background: #16a34a;
}
.toast--error {
  background: #dc2626;
}
.toast--info {
  background: #4f46e5;
}
</style>

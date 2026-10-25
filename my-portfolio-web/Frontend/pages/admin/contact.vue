<!-- [MVC-V] bandeja de envíos del formulario de contacto — protegida por middleware admin. -->
<script setup lang="ts">
import { onMounted } from 'vue';
import { definePageMeta } from '#imports';
import { useAuthStore } from '~/stores/useAuthStore';
import { useContactAdmin } from '~/composables/useContactAdmin';
import { useToast } from '~/composables/useToast';
import { CONTACT_STATUSES } from '~/shared/api/contracts';
import type { ContactStatus, ContactSubmission } from '~/shared/api/contracts';

// [GUARD] middleware admin exige token + rol ADMIN antes de montar.
definePageMeta({ middleware: 'admin', layout: 'admin' });

const auth = useAuthStore();
const toast = useToast();
const inbox = useContactAdmin();

// Nest devuelve createdAt, FastAPI created_at → el contrato admite ambos.
function receivedAt(item: ContactSubmission): string {
  const raw = item.createdAt ?? item.created_at;
  return raw ? new Date(raw).toLocaleString() : '';
}

const STATUS_LABEL: Record<ContactStatus, string> = {
  pending: 'Pendiente',
  read: 'Leído',
  replied: 'Respondido',
  archived: 'Archivado',
};

// [ML] etiquetas legibles de la categoría del clasificador.
const CATEGORY_LABEL: Record<string, string> = {
  job: 'Oferta de empleo',
  freelance: 'Freelance',
  spam: 'Spam',
};

async function onStatus(item: ContactSubmission, next: ContactStatus): Promise<void> {
  try {
    await inbox.setStatus(item.id, next);
    toast.success(`Marcado como ${STATUS_LABEL[next].toLowerCase()}`);
  } catch (e) {
    toast.error((e as Error).message);
  }
}

async function onDelete(item: ContactSubmission): Promise<void> {
  if (!confirm(`¿Borrar el mensaje de "${item.name}"? No se puede deshacer.`)) return;
  try {
    await inbox.remove(item.id);
    toast.success('Mensaje borrado');
  } catch (e) {
    toast.error((e as Error).message);
  }
}

// El rol ya está garantizado por el middleware admin; aquí solo cargamos datos.
onMounted(async () => {
  await inbox.fetchAll();
});
</script>

<template>
  <section class="admin">
    <header class="admin__head">
      <h1>Contacto (admin)</h1>
      <span class="admin__provider">backend: {{ auth.provider }}</span>
    </header>

    <!-- Filtros por estado -->
    <div class="filters">
      <button
        type="button"
        :class="['filters__chip', !inbox.status.value && 'filters__chip--on']"
        @click="inbox.filterBy(null)"
      >
        Todos ({{ inbox.total.value }})
      </button>
      <button
        v-for="s in CONTACT_STATUSES"
        :key="s"
        type="button"
        :class="['filters__chip', inbox.status.value === s && 'filters__chip--on']"
        @click="inbox.filterBy(s)"
      >
        {{ STATUS_LABEL[s] }}
      </button>
    </div>

    <p v-if="inbox.error.value" class="msg__error">{{ inbox.error.value }}</p>

    <div class="mlist">
      <p v-if="inbox.loading.value && !inbox.items.value.length">Cargando…</p>
      <p v-else-if="!inbox.items.value.length" class="mlist__empty">
        No hay mensajes con ese filtro.
      </p>

      <article v-for="m in inbox.items.value" :key="m.id" class="mcard">
        <div class="mcard__body">
          <h3 class="mcard__title">
            {{ m.name }}
            <span :class="['mcard__badge', `mcard__badge--${m.status}`]">
              {{ STATUS_LABEL[m.status] }}
            </span>
            <!-- [ML] categoría + prioridad detectadas por el clasificador. -->
            <span v-if="m.category" :class="['mcard__cat', `mcard__cat--${m.category}`]">
              {{ CATEGORY_LABEL[m.category] ?? m.category }}
            </span>
            <span v-if="m.priority" :class="['mcard__prio', `mcard__prio--${m.priority}`]">
              {{ m.priority }}
            </span>
          </h3>
          <a :href="`mailto:${m.email}`" class="mcard__email">{{ m.email }}</a>
          <p class="mcard__msg">{{ m.message }}</p>
          <p class="mcard__meta">{{ receivedAt(m) }}</p>
        </div>

        <div class="mcard__actions">
          <button v-if="m.status !== 'read'" type="button" @click="onStatus(m, 'read')">
            Leído
          </button>
          <button v-if="m.status !== 'replied'" type="button" @click="onStatus(m, 'replied')">
            Respondido
          </button>
          <button v-if="m.status !== 'archived'" type="button" @click="onStatus(m, 'archived')">
            Archivar
          </button>
          <button type="button" class="mcard__del" @click="onDelete(m)">Borrar</button>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.admin {
  max-width: 48rem;
  margin: 3rem auto;
  padding: 0 1.5rem;
}
.admin__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}
.admin__provider {
  font-size: 0.8rem;
  opacity: 0.6;
  text-transform: uppercase;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}
.filters__chip {
  padding: 0.35rem 0.9rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: transparent;
  font-size: 0.85rem;
  cursor: pointer;
}
.filters__chip--on {
  border-color: #818cf8;
  background: rgba(129, 140, 248, 0.15);
  color: #c7d2fe;
}
.msg__error {
  color: #f87171;
  margin-bottom: 1rem;
}
.mlist {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.mlist__empty {
  opacity: 0.6;
}
.mcard {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem;
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
}
.mcard__title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 600;
}
.mcard__badge,
.mcard__cat,
.mcard__prio {
  font-size: 0.7rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-left: 0.35rem;
}
/* [ML] categoría */
.mcard__cat--job {
  background: rgba(99, 102, 241, 0.2);
  color: #818cf8;
}
.mcard__cat--freelance {
  background: rgba(168, 85, 247, 0.2);
  color: #c084fc;
}
.mcard__cat--spam {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}
/* [ML] prioridad */
.mcard__prio--high {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}
.mcard__prio--medium {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
}
.mcard__prio--low {
  background: rgba(148, 163, 184, 0.15);
  color: #94a3b8;
}
.mcard__badge--pending {
  background: rgba(251, 191, 36, 0.2);
  color: #fbbf24;
}
.mcard__badge--read {
  background: rgba(96, 165, 250, 0.2);
  color: #60a5fa;
}
.mcard__badge--replied {
  background: rgba(52, 211, 153, 0.2);
  color: #34d399;
}
.mcard__badge--archived {
  background: rgba(148, 163, 184, 0.2);
  color: #94a3b8;
}
.mcard__email {
  display: block;
  font-size: 0.85rem;
  color: #818cf8;
  margin: 0.25rem 0 0.6rem;
}
.mcard__msg {
  white-space: pre-wrap;
  line-height: 1.5;
}
.mcard__meta {
  margin-top: 0.6rem;
  font-size: 0.75rem;
  opacity: 0.5;
}
.mcard__actions {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex-shrink: 0;
}
.mcard__actions button {
  padding: 0.35rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: transparent;
  font-size: 0.8rem;
  cursor: pointer;
}
.mcard__del {
  border-color: rgba(248, 113, 113, 0.5) !important;
  color: #f87171;
}
</style>

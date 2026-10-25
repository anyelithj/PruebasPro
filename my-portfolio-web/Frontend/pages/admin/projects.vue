<!-- [MVC-V] CRUD admin de proyectos — protegido por middleware admin. -->
<script setup lang="ts">
import { onMounted, reactive, ref, computed } from 'vue';
import { definePageMeta } from '#imports';
import { useAuthStore } from '~/stores/useAuthStore';
import { useProjectsAdmin } from '~/composables/useProjectsAdmin';
import { useToast } from '~/composables/useToast';
import ImageUploader from '~/components/molecules/ImageUploader.vue';
import type { AdminProject } from '~/shared/api/contracts';

// [GUARD] middleware admin exige token + rol ADMIN antes de montar.
definePageMeta({ middleware: 'admin', layout: 'admin' });

const auth = useAuthStore();
const toast = useToast();
const projects = useProjectsAdmin();

const editingId = ref<string | null>(null);
const form = reactive({ title: '', description: '', link: '', techsCsv: '', featured: false, imageUrl: '' });

const isEditing = computed(() => editingId.value !== null);

function resetForm(): void {
  editingId.value = null;
  form.title = '';
  form.description = '';
  form.link = '';
  form.techsCsv = '';
  form.featured = false;
  form.imageUrl = '';
}

function startEdit(p: AdminProject): void {
  editingId.value = p.id;
  form.title = p.title;
  form.description = p.description;
  form.link = p.link;
  form.techsCsv = (p.techs ?? []).join(', ');
  form.featured = p.featured;
  form.imageUrl = p.imageUrl ?? '';
}

function parseTechs(csv: string): string[] {
  return csv
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

async function submit(): Promise<void> {
  const payload = {
    title: form.title,
    description: form.description,
    link: form.link,
    techs: parseTechs(form.techsCsv),
    featured: form.featured,
    ...(form.imageUrl ? { imageUrl: form.imageUrl } : {}),
  };
  try {
    if (isEditing.value && editingId.value) {
      await projects.update(editingId.value, payload);
      toast.success('Proyecto actualizado');
    } else {
      await projects.create(payload);
      toast.success('Proyecto creado');
    }
    resetForm();
  } catch (e) {
    toast.error((e as Error).message);
  }
}

async function onDelete(p: AdminProject): Promise<void> {
  if (!confirm(`¿Borrar "${p.title}"?`)) return;
  try {
    await projects.remove(p.id);
    toast.success('Proyecto borrado');
    if (editingId.value === p.id) resetForm();
  } catch (e) {
    toast.error((e as Error).message);
  }
}

// El rol ya está garantizado por el middleware admin; aquí solo cargamos datos.
onMounted(async () => {
  await projects.fetchAll();
});
</script>

<template>
  <section class="admin">
    <header class="admin__head">
      <h1>Proyectos (admin)</h1>
      <span class="admin__provider">backend: {{ auth.provider }}</span>
    </header>

    <!-- Formulario crear / editar -->
    <form class="pform" @submit.prevent="submit">
      <h2>{{ isEditing ? 'Editar proyecto' : 'Nuevo proyecto' }}</h2>
      <label class="pform__field">
        <span>Título</span>
        <input v-model="form.title" type="text" required maxlength="160" />
      </label>
      <label class="pform__field">
        <span>Descripción</span>
        <textarea v-model="form.description" required maxlength="2000" rows="3" />
      </label>
      <label class="pform__field">
        <span>Link (URL)</span>
        <input v-model="form.link" type="url" required placeholder="https://…" />
      </label>
      <label class="pform__field">
        <span>Tecnologías (separadas por coma)</span>
        <input v-model="form.techsCsv" type="text" placeholder="Vue, TypeScript, Node" />
      </label>
      <div class="pform__field">
        <ImageUploader v-model="form.imageUrl" label="Imagen del proyecto" />
      </div>
      <label class="pform__check">
        <input v-model="form.featured" type="checkbox" />
        <span>Destacado</span>
      </label>

      <div class="pform__actions">
        <button type="submit" :disabled="projects.loading.value">
          {{ projects.loading.value ? '...' : isEditing ? 'Guardar cambios' : 'Crear' }}
        </button>
        <button v-if="isEditing" type="button" class="pform__cancel" @click="resetForm">
          Cancelar
        </button>
      </div>
      <p v-if="projects.error.value" class="pform__error">{{ projects.error.value }}</p>
    </form>

    <!-- Listado -->
    <div class="plist">
      <p v-if="projects.loading.value && !projects.items.value.length">Cargando…</p>
      <p v-else-if="!projects.items.value.length" class="plist__empty">Sin proyectos aún.</p>
      <article v-for="p in projects.items.value" :key="p.id" class="pcard">
        <div class="pcard__body">
          <h3>
            {{ p.title }}
            <span v-if="p.featured" class="pcard__badge">★ destacado</span>
          </h3>
          <p class="pcard__desc">{{ p.description }}</p>
          <a :href="p.link" target="_blank" rel="noopener" class="pcard__link">{{ p.link }}</a>
          <ul class="pcard__techs">
            <li v-for="t in p.techs" :key="t">{{ t }}</li>
          </ul>
        </div>
        <div class="pcard__actions">
          <button type="button" @click="startEdit(p)">Editar</button>
          <button type="button" class="pcard__del" @click="onDelete(p)">Borrar</button>
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
.pform {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.5rem;
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  margin-bottom: 2rem;
}
.pform h2 {
  font-size: 1.1rem;
  font-weight: 600;
}
.pform__field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.85rem;
}
.pform__field input,
.pform__field textarea {
  padding: 0.6rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.2);
  color: inherit;
}
.pform__check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
}
.pform__actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
}
.pform__actions button {
  padding: 0.6rem 1.2rem;
  border-radius: 0.5rem;
  border: none;
  background: rgb(99, 102, 241);
  color: white;
  font-weight: 600;
  cursor: pointer;
}
.pform__cancel {
  background: transparent !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  color: inherit !important;
}
.pform__error {
  color: #f87171;
  font-size: 0.85rem;
}
.plist {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.plist__empty {
  opacity: 0.6;
}
.pcard {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem;
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
}
.pcard__body h3 {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.pcard__badge {
  font-size: 0.7rem;
  color: rgb(250, 204, 21);
}
.pcard__desc {
  font-size: 0.9rem;
  opacity: 0.85;
  margin: 0.35rem 0;
}
.pcard__link {
  font-size: 0.8rem;
  color: rgb(129, 140, 248);
  word-break: break-all;
}
.pcard__techs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.5rem;
}
.pcard__techs li {
  font-size: 0.72rem;
  padding: 0.15rem 0.5rem;
  border-radius: 0.4rem;
  background: rgba(99, 102, 241, 0.2);
}
.pcard__actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.pcard__actions button {
  padding: 0.4rem 0.9rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 0.8rem;
}
.pcard__del {
  border-color: rgba(248, 113, 113, 0.5) !important;
  color: #f87171 !important;
}
</style>

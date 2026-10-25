<!-- [MVC-V] CRUD del blog (backend Nest /posts). Protegido por middleware admin. -->
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { definePageMeta } from '#imports';
import { usePostsAdmin } from '~/composables/usePostsAdmin';
import { useToast } from '~/composables/useToast';
import { createPostSchema } from '~/shared/schemas/post-admin.schema';
import ImageUploader from '~/components/molecules/ImageUploader.vue';
import type { BlogPost } from '~/shared/api/contracts';

definePageMeta({ middleware: 'admin', layout: 'admin' });

const posts = usePostsAdmin();
const toast = useToast();

const editingId = ref<string | null>(null);
const showForm = ref(false);
const form = reactive({
  title: '',
  excerpt: '',
  content: '',
  tagsCsv: '',
  imageUrl: '',
  published: false,
});
const fieldErrors = reactive<Record<string, string>>({});

const isEditing = computed(() => editingId.value !== null);

onMounted(() => posts.fetchAll());

function resetForm(): void {
  editingId.value = null;
  form.title = '';
  form.excerpt = '';
  form.content = '';
  form.tagsCsv = '';
  form.imageUrl = '';
  form.published = false;
  Object.keys(fieldErrors).forEach((k) => delete fieldErrors[k]);
}

function newPost(): void {
  resetForm();
  showForm.value = true;
}

function startEdit(p: BlogPost): void {
  editingId.value = p.id;
  form.title = p.title;
  form.excerpt = p.excerpt;
  form.content = p.content;
  form.tagsCsv = (p.tags ?? []).join(', ');
  form.imageUrl = p.imageUrl ?? '';
  form.published = p.published;
  showForm.value = true;
}

function parseTags(csv: string): string[] {
  return csv.split(',').map((t) => t.trim()).filter(Boolean);
}

function fmt(iso?: string): string {
  return iso ? new Date(iso).toLocaleDateString('es', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
}

async function submit(): Promise<void> {
  Object.keys(fieldErrors).forEach((k) => delete fieldErrors[k]);
  const payload = {
    title: form.title,
    excerpt: form.excerpt,
    content: form.content,
    tags: parseTags(form.tagsCsv),
    published: form.published,
    ...(form.imageUrl ? { imageUrl: form.imageUrl } : {}),
  };
  const parsed = createPostSchema.safeParse(payload);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string') fieldErrors[key] = issue.message;
    }
    return;
  }
  try {
    if (isEditing.value && editingId.value) {
      await posts.update(editingId.value, parsed.data);
      toast.success('Post actualizado');
    } else {
      await posts.create(parsed.data);
      toast.success('Post creado');
    }
    resetForm();
    showForm.value = false;
  } catch (e) {
    toast.error((e as Error).message);
  }
}

async function togglePublish(p: BlogPost): Promise<void> {
  try {
    await posts.update(p.id, { published: !p.published });
    toast.success(p.published ? 'Pasado a borrador' : 'Publicado');
  } catch (e) {
    toast.error((e as Error).message);
  }
}

async function onDelete(p: BlogPost): Promise<void> {
  if (!confirm(`¿Borrar "${p.title}"? No se puede deshacer.`)) return;
  try {
    await posts.remove(p.id);
    toast.success('Post borrado');
    if (editingId.value === p.id) {
      resetForm();
      showForm.value = false;
    }
  } catch (e) {
    toast.error((e as Error).message);
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-black sm:text-3xl">Blog</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {{ posts.items.value.length }} post(s) · gestión completa (crear, editar, publicar, borrar)
        </p>
      </div>
      <button
        type="button"
        class="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        @click="newPost"
      >
        <font-awesome-icon :icon="['fas', 'plus']" />
        Nuevo post
      </button>
    </header>

    <!-- Formulario crear/editar -->
    <form
      v-if="showForm"
      class="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900"
      @submit.prevent="submit"
    >
      <h2 class="text-lg font-bold">{{ isEditing ? 'Editar post' : 'Nuevo post' }}</h2>

      <label class="block">
        <span class="text-sm font-semibold text-gray-700 dark:text-gray-200">Título</span>
        <input v-model="form.title" type="text" class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-800 focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-gray-600 dark:bg-slate-800 dark:text-white" />
        <span v-if="fieldErrors.title" class="text-xs text-red-500">{{ fieldErrors.title }}</span>
      </label>

      <label class="block">
        <span class="text-sm font-semibold text-gray-700 dark:text-gray-200">Resumen</span>
        <input v-model="form.excerpt" type="text" maxlength="400" class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-800 focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-gray-600 dark:bg-slate-800 dark:text-white" />
        <span v-if="fieldErrors.excerpt" class="text-xs text-red-500">{{ fieldErrors.excerpt }}</span>
      </label>

      <ImageUploader v-model="form.imageUrl" label="Portada" />

      <label class="block">
        <span class="text-sm font-semibold text-gray-700 dark:text-gray-200">Contenido (Markdown)</span>
        <textarea v-model="form.content" rows="12" class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-800 focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-gray-600 dark:bg-slate-800 dark:text-white" placeholder="# Título&#10;&#10;Escribe en **Markdown**…"></textarea>
        <span v-if="fieldErrors.content" class="text-xs text-red-500">{{ fieldErrors.content }}</span>
      </label>

      <label class="block">
        <span class="text-sm font-semibold text-gray-700 dark:text-gray-200">Tags (separados por coma)</span>
        <input v-model="form.tagsCsv" type="text" placeholder="nestjs, arquitectura" class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-800 focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-gray-600 dark:bg-slate-800 dark:text-white" />
      </label>

      <label class="flex items-center gap-2">
        <input v-model="form.published" type="checkbox" class="h-4 w-4 rounded" />
        <span class="text-sm font-medium text-gray-700 dark:text-gray-200">Publicado (visible en el sitio)</span>
      </label>

      <div class="flex gap-3">
        <button type="submit" :disabled="posts.loading.value" class="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50">
          <font-awesome-icon :icon="['fas', 'floppy-disk']" />
          {{ posts.loading.value ? 'Guardando…' : 'Guardar' }}
        </button>
        <button type="button" class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5" @click="showForm = false; resetForm()">
          Cancelar
        </button>
      </div>
    </form>

    <!-- Lista -->
    <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-slate-900">
      <table class="w-full text-sm">
        <thead class="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400 dark:border-white/10">
          <tr>
            <th class="px-4 py-3">Título</th>
            <th class="px-4 py-3">Fecha</th>
            <th class="px-4 py-3">Estado</th>
            <th class="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!posts.items.value.length">
            <td colspan="4" class="px-4 py-8 text-center text-gray-400">No hay posts. Crea el primero.</td>
          </tr>
          <tr v-for="p in posts.items.value" :key="p.id" class="border-b border-gray-50 last:border-0 dark:border-white/5">
            <td class="px-4 py-3 font-semibold">{{ p.title }}</td>
            <td class="px-4 py-3 text-gray-500 dark:text-gray-400">{{ fmt(p.createdAt) }}</td>
            <td class="px-4 py-3">
              <button
                type="button"
                class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase transition"
                :class="p.published ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'"
                :title="p.published ? 'Clic para pasar a borrador' : 'Clic para publicar'"
                @click="togglePublish(p)"
              >
                {{ p.published ? 'Publicado' : 'Borrador' }}
              </button>
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center justify-end gap-3">
                <a v-if="p.published" :href="`/blog/${p.slug}`" target="_blank" rel="noopener" class="text-gray-400 hover:text-indigo-500" title="Ver">
                  <font-awesome-icon :icon="['fas', 'up-right-from-square']" />
                </a>
                <button type="button" class="text-indigo-500 hover:text-indigo-600" title="Editar" @click="startEdit(p)">
                  <font-awesome-icon :icon="['fas', 'pen']" />
                </button>
                <button type="button" class="text-red-500 hover:text-red-600" title="Borrar" @click="onDelete(p)">
                  <font-awesome-icon :icon="['fas', 'trash']" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="posts.error.value" class="text-sm text-red-500">{{ posts.error.value }}</p>
  </div>
</template>

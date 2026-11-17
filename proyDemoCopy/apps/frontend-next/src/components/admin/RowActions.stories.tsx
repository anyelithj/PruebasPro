// [Historias · RowActions · 2026-11-17]: Acciones por fila de Gestión (ver, editar, publicar, eliminar) | [Patrón]: CSF 3 + Command + Confirm Dialog + Strategy (confirm) | [Principio]: OCP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { okAction } from "@/docs/story-fixtures"; // [Object Mother]: datos de ejemplo compartidos
import { RowActions } from "./RowActions";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Admin/RowActions",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Acciones por fila de Gestión (ver, editar, publicar, eliminar)\n\n**Patrón:** Command + Confirm Dialog + Strategy (confirm) · **Principio:** OCP · **Paradigma:** Declarativo" } } },
  component: RowActions,
  args: { title: "Curso de inglés", deleteTitle: "¿Eliminar el curso?", viewHref: "/courses/course-1", editHref: "/admin/courses/course-1/edit", publish: { isPublished: false, toggle: okAction }, onDelete: okAction },
} satisfies Meta<typeof RowActions>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
export const Published: Story = { args: { publish: { isPublished: true, toggle: okAction } } };
export const PublishBlocked: Story = { args: { publish: { isPublished: false, toggle: okAction, blocked: "El curso aún no tiene examen final" } } };
export const IconsOnly: Story = { args: { icons: true } };

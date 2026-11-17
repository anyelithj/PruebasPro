// [Historias · Pagination]: paginador de tablas con enlaces reales (?page=) | [Patrón]: CSF 3 + URL State | [Principio]: DRY + KISS | [Paradigma]: Declarativo
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Pagination } from "./Pagination";

const meta = {
  title: "Shared/Pagination",
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Paginador de tablas con enlaces reales (?page=).\n\n**Patrón:** CSF 3 + URL State · **Principio:** DRY + KISS · **Paradigma:** Declarativo" } } },
  component: Pagination,
  // [query]: los filtros actuales se conservan en cada enlace (tab=examenes)
  args: { page: 2, pages: 5, pathname: "/admin/users", query: { tab: "examenes" } },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

// [A11y]: <nav aria-label> + aria-current="page" en la página activa (no solo color)
export const Default: Story = {};
export const LastPage: Story = { args: { page: 5 } };
// [Una página]: devuelve null → no hay controles que mostrar (guard clause del componente)
export const SinglePage: Story = { args: { page: 1, pages: 1 } };

// [Historias · BackLink]: enlace «volver» único del sitio (flecha + texto) | [Patrón]: CSF 3 + Atomic Design (atom) | [Principio]: SRP | [Paradigma]: Declarativo
// [next/link]: en Storybook lo resuelve el framework @storybook/nextjs-vite (sin navegar fuera del lienzo) | [Patrón]: Stub
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BackLink } from "./BackLink";

const meta = {
  title: "Shared/BackLink",
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Enlace «volver» único del sitio (flecha + texto).\n\n**Patrón:** CSF 3 + Atomic Design (atom) · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: BackLink,
  args: { href: "/courses", children: "Volver a cursos" }, // [args]: props comunes | [Principio]: DRY
} satisfies Meta<typeof BackLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
// [memo]: con una clave anotada por RememberReturn (sessionStorage) vuelve a la pestaña/filtros de origen | [Patrón]: Memento
export const WithMemo: Story = { args: { memo: "admin-users", href: "/admin/users", children: "Volver a usuarios" } };

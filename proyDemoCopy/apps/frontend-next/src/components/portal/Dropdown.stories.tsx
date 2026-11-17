// [Historias · Dropdown · 2026-11-17]: Menú desplegable accesible con render prop | [Patrón]: CSF 3 + Render Props + Atomic Design (molecule) | [Principio]: OCP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Dropdown } from "./Dropdown";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Portal/Dropdown",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Menú desplegable accesible con render prop\n\n**Patrón:** Render Props + Atomic Design (molecule) · **Principio:** OCP · **Paradigma:** Declarativo" } } },
  component: Dropdown,
  args: {
    label: "Abrir menú",
    trigger: "Opciones",
    // Render prop (React): el contenido recibe `close` para cerrar el panel
    children: (close: () => void) => (
      <ul className="p-2">
        <li><button type="button" role="menuitem" onClick={close}>Perfil</button></li>
        <li><button type="button" role="menuitem" onClick={close}>Cerrar sesión</button></li>
      </ul>
    ),
  },
} satisfies Meta<typeof Dropdown>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
export const WithBadge: Story = { args: { badge: <span className="rounded-full bg-red-600 px-1 text-xs text-white">3</span> } };

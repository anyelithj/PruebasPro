// [Historias · KindIcon]: icono SVG de cada tipo de recurso | [Patrón]: CSF 3 + Lookup Table (KIND_ICON) + Atomic Design (atom) | [Principio]: SSOT | [Paradigma]: Declarativo
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { CurriculumItemKind } from "@/types/curriculum";
import { KIND_ICON, KindIcon } from "./KindIcon";

// `Object.keys` (ES5) + cast (TS): los tipos salen de la tabla → si se añade uno, aparece aquí solo | [Principio]: OCP
const KINDS = Object.keys(KIND_ICON) as CurriculumItemKind[];

const meta = {
  title: "Shared/KindIcon",
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Icono SVG de cada tipo de recurso.\n\n**Patrón:** CSF 3 + Lookup Table (KIND_ICON) + Atomic Design (atom) · **Principio:** SSOT · **Paradigma:** Declarativo" } } },
  component: KindIcon,
  args: { kind: "vocabulary", className: "size-6" },
  argTypes: { kind: { control: "select", options: KINDS } }, // Selector con los tipos reales
} satisfies Meta<typeof KindIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
// [Sin kind]: «Todos» → cuadrícula
export const All: Story = { args: { kind: undefined } };
// [Galería]: icono decorativo (aria-hidden) + nombre escrito al lado, como en la app (WCAG 1.1.1)
export const Gallery: Story = {
  render: () => (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {KINDS.map((k) => (
        <li key={k} className="flex items-center gap-2 text-sm">
          <KindIcon kind={k} className="size-5 text-tone-brand" />
          <code>{k}</code>
        </li>
      ))}
    </ul>
  ),
};

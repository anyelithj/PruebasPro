// [Historias · DetailHeader + DetailGrid + DetailCard + ToneBadge]: piezas de la página de detalle de Gestión | [Patrón]: CSF 3 + Atomic Design (molecules) + Slots | [Principio]: SRP + DRY | [Paradigma]: Declarativo
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import { DetailCard, DetailGrid, DetailHeader, ToneBadge, type BadgeTone } from "./DetailHeader";
import { KindIcon } from "./KindIcon";

const meta = {
  title: "Shared/DetailHeader",
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Piezas de la página de detalle de Gestión.\n\n**Patrón:** CSF 3 + Atomic Design (molecules) + Slots · **Principio:** SRP + DRY · **Paradigma:** Declarativo" } } },
  component: DetailHeader,
  // [args]: cada prop ReactNode es un Slot que la página rellena | [Patrón]: Slot
  args: {
    icon: <KindIcon kind="vocabulary" className="size-8" />,
    title: "Vocabulario: la granja",
    meta: "Recurso · Inglés · A2 · 12 elementos · Publicado",
    actions: <Button variant="outline" size="sm">Editar</Button>,
  },
} satisfies Meta<typeof DetailHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
// [Sin acciones]: `actions` opcional → el header no reserva hueco
export const WithoutActions: Story = { args: { actions: undefined } };

// `as const satisfies` (TS): tupla de literales validada contra BadgeTone → no se cuela un tono inexistente (Type-Safe)
const TONES = [
  ["brand", "Publicado"],
  ["warning", "En revisión"],
  ["danger", "Rechazado"],
  ["muted", "Borrador"],
] as const satisfies ReadonlyArray<readonly [BadgeTone, string]>;

// [Página completa]: cabecera + rejilla de tarjetas, una por estado | `map` (ES5): render declarativo de la lista
export const WithGrid: Story = {
  render: (args) => (
    <div className="space-y-4">
      <DetailHeader {...args} />
      <DetailGrid label="Elementos del recurso">
        {TONES.map(([tone, text]) => (
          <DetailCard key={tone} title={`Elemento ${text.toLowerCase()}`} badge={<ToneBadge tone={tone}>{text}</ToneBadge>} footer={<Button variant="ghost" size="xs">Ver</Button>} lang="en">
            The cow eats grass on the farm.
          </DetailCard>
        ))}
      </DetailGrid>
    </div>
  ),
};

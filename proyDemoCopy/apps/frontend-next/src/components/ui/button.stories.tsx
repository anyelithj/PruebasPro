// [Historias · Button]: variantes y tamaños del átomo Button | [Patrón]: Component Story Format (CSF 3) + Atomic Design (atom) | [Principio]: SRP (una historia = un estado) | [Paradigma]: Declarativo
// `Meta`/`StoryObj` (Storybook): tipos que derivan los controles de las props reales del componente (Type-Safe)
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test"; // `fn` (Storybook): espía que registra los clics en el panel Actions | [Patrón]: Spy
import { Button } from "./button";

// `satisfies` (TS): valida la forma contra Meta<typeof Button> sin perder el tipo inferido
const meta = {
  title: "UI/Atoms/Button",
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Variantes y tamaños del átomo Button.\n\n**Patrón:** Component Story Format (CSF 3) + Atomic Design (atom) · **Principio:** SRP (una historia = un estado) · **Paradigma:** Declarativo" } } },
  component: Button,
  args: { children: "Continuar", onClick: fn() }, // [args]: props comunes a todas las historias | [Principio]: DRY
  argTypes: {
    // [argTypes]: selectores con las variantes reales de buttonVariants (CVA)
    variant: { control: "select", options: ["default", "outline", "secondary", "ghost", "destructive", "link"] },
    size: { control: "select", options: ["default", "xs", "sm", "lg"] },
  },
} satisfies Meta<typeof Button>;

export default meta;
// `type` (TS): alias del tipo de historia de este meta
type Story = StoryObj<typeof meta>;

// [Historias]: cada `export const` es un estado visible en Storybook y en autodocs
export const Primary: Story = {};
export const Outline: Story = { args: { variant: "outline" } };
export const Ghost: Story = { args: { variant: "ghost" } };
export const Destructive: Story = { args: { variant: "destructive", children: "Eliminar" } };
export const Link: Story = { args: { variant: "link", children: "Ver detalle" } };
export const Small: Story = { args: { size: "sm" } };
export const Large: Story = { args: { size: "lg" } };
export const Disabled: Story = { args: { disabled: true } }; // `disabled` (HTML): no interactivo; el lector de pantalla lo anuncia

// [Historias · Input y PasswordInput]: estados de los campos de formulario | [Patrón]: Component Story Format (CSF 3) + Atomic Design (atom) | [Principio]: SRP | [Paradigma]: Declarativo
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Input } from "./input";
import { Label } from "./label";
import { PasswordInput } from "./password-input";

const meta = {
  title: "UI/Atoms/Input",
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Estados de los campos de formulario.\n\n**Patrón:** Component Story Format (CSF 3) + Atomic Design (atom) · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: Input,
  // [render]: Label + Input unidos por id/htmlFor → nombre accesible (WCAG 1.3.1 · 4.1.2); axe falla si falta
  render: (args) => (
    <div className="grid gap-2 max-w-sm">
      <Label htmlFor="email">Correo electrónico</Label>
      <Input id="email" {...args} />
    </div>
  ),
  args: { type: "email", placeholder: "tu@correo.com" },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
// `aria-invalid` (WAI-ARIA): anuncia el error al lector de pantalla y activa el estilo de error de la utilidad `control`
export const Invalid: Story = { args: { "aria-invalid": true, defaultValue: "correo-no-valido" } };
export const Disabled: Story = { args: { disabled: true, defaultValue: "bloqueado@correo.com" } };

// [Password]: campo con botón ver/ocultar (aria-pressed) | [Patrón]: Composite
export const Password: Story = {
  render: () => (
    <div className="grid gap-2 max-w-sm">
      <Label htmlFor="password">Contraseña</Label>
      <PasswordInput id="password" placeholder="••••••••" />
    </div>
  ),
};

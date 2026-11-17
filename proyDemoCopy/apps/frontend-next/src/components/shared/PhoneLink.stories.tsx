// [Historias · PhoneLink]: teléfono como enlace tel: o «—» si falta | [Patrón]: CSF 3 + Presentational (atom) | [Principio]: SRP | [Paradigma]: Funcional
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PhoneLink } from "./PhoneLink";

const meta = {
  title: "Shared/PhoneLink",
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Teléfono como enlace tel: o «—» si falta.\n\n**Patrón:** CSF 3 + Presentational (atom) · **Principio:** SRP · **Paradigma:** Funcional" } } },
  component: PhoneLink,
  args: { phone: "+57 300 123-4567" }, // href resultante: tel:+573001234567 (RFC 3966, sin espacios)
} satisfies Meta<typeof PhoneLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
// [null]: el backend no tiene teléfono → guion largo
export const Empty: Story = { args: { phone: null } };

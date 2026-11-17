// [Historias · CoursePrice · 2026-11-17]: Precio con descuento, gratis o pro bono | [Patrón]: CSF 3 + Atomic Design (molecule) | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CoursePrice } from "./CoursePrice";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Courses/CoursePrice",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Precio con descuento, gratis o pro bono\n\n**Patrón:** Atomic Design (molecule) · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: CoursePrice,
  args: { price: 49, originalPrice: 79, isFree: false, tokens: 0, discountPercent: 38, isProBono: false, currency: "USD", color: "#2563eb" },
} satisfies Meta<typeof CoursePrice>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Discount: Story = {};
export const Free: Story = { args: { isFree: true, price: 0, originalPrice: null, discountPercent: 0 } };

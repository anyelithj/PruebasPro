// [Historias · FaqSection · 2026-11-17]: Preguntas frecuentes con JSON-LD FAQPage | [Patrón]: CSF 3 + Atomic Design (organism) | [Principio]: SRP | [Paradigma]: Declarativo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { dict } from "@/docs/story-fixtures"; // [Object Mother]: datos de ejemplo compartidos
import { FaqSection } from "./FaqSection";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Landing/FaqSection",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Preguntas frecuentes con JSON-LD FAQPage\n\n**Patrón:** Atomic Design (organism) · **Principio:** SRP · **Paradigma:** Declarativo" } } },
  component: FaqSection,
  args: { l: dict.landing, faqs: [{ q: "¿Es gratis?", a: "Hay cursos gratuitos y de pago." }, { q: "¿Qué idiomas hay?", a: "Siete: inglés, francés, alemán, español, portugués, chino y ruso." }] },
} satisfies Meta<typeof FaqSection>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};

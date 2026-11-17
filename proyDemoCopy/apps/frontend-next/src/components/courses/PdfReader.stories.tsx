// [Historias · PdfReader · 2026-11-17]: Lector en voz alta con resaltado (aquí con texto, sin PDF) | [Patrón]: CSF 3 + State Machine (reproductor) + Adapter (Web Speech API) | [Principio]: SRP | [Paradigma]: Reactivo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PdfReader } from "./PdfReader";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Courses/PdfReader",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Lector en voz alta con resaltado (aquí con texto, sin PDF)\n\n**Patrón:** State Machine (reproductor) + Adapter (Web Speech API) · **Principio:** SRP · **Paradigma:** Reactivo" } } },
  component: PdfReader,
  args: { text: "Good morning. Where is the gate? The flight leaves at nine.", lang: "en", color: "#2563eb" },
} satisfies Meta<typeof PdfReader>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {};
export const Compact: Story = { args: { compact: true } };

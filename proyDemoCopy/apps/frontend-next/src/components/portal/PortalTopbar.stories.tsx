// [Historias · PortalTopbar · 2026-11-17]: Barra superior del portal (carrito, avisos y perfil) | [Patrón]: CSF 3 + Atomic Design (organism) + Observer (SSE) | [Principio]: SRP | [Paradigma]: Reactivo
// `import type` (TS): Meta y StoryObj solo existen en compilación → cero peso en el bundle
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PortalTopbar } from "./PortalTopbar";

// `satisfies Meta<typeof X>` (TS): valida el objeto sin ensanchar su tipo → args tipados en cada historia
const meta = {
  title: "Portal/PortalTopbar",
  // [docs.description]: texto de la página autodocs | [Principio]: Documentación viva
  parameters: { docs: { description: { component: "Barra superior del portal (carrito, avisos y perfil)\n\n**Patrón:** Atomic Design (organism) + Observer (SSE) · **Principio:** SRP · **Paradigma:** Reactivo" } } },
  component: PortalTopbar,
  args: { user: { name: "Ana Pérez", email: "ana@example.org", roleLabel: "Estudiante", initials: "AP", gradient: "linear-gradient(135deg,#2563eb,#7c3aed)" } },
} satisfies Meta<typeof PortalTopbar>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<typeof meta>; // Tipo de cada historia (args parciales sobre el meta)

export const Default: Story = {}; // Sin backend: avisos vacíos (EventSource reintenta en silencio)

// [Historias · Toaster]: avisos breves publicados con `toast()` | [Patrón]: CSF 3 + Observer (evento `aula:toast` en window) | [Principio]: SRP + DIP | [Paradigma]: Reactivo
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/ui/button";
import { toast, Toaster, type ToastKind } from "./Toaster";

// `Record<ToastKind, string>` (TS): un mensaje por tipo → no se olvida ninguno (Type-Safe)
const MESSAGES: Record<ToastKind, string> = {
  success: "Registro guardado.",
  error: "No se pudo guardar el registro.",
  warning: "Hay campos sin completar.",
  info: "El curso se publicará mañana.",
};

const meta = {
  title: "Shared/Toaster",
  component: Toaster,
  // [render]: el Toaster escucha; los botones publican el evento igual que cualquier Client Component o Angular Element
  render: () => (
    <div className="flex flex-wrap gap-2">
      {/* `Object.entries` (ES2017) + cast: pares [tipo, mensaje] tipados */}
      {(Object.entries(MESSAGES) as [ToastKind, string][]).map(([kind, message]) => (
        <Button key={kind} variant="outline" size="sm" onClick={() => toast(kind, message)}>
          {kind}
        </Button>
      ))}
      <Toaster />
    </div>
  ),
  // [inline=false]: los avisos son `fixed` (abajo a la derecha) → iframe propio en autodocs
  parameters: { docs: { description: { component: "Avisos breves publicados con `toast()`.\n\n**Patrón:** CSF 3 + Observer (evento `aula:toast` en window) · **Principio:** SRP + DIP · **Paradigma:** Reactivo" }, story: { inline: false, iframeHeight: 360 } } },
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

// [A11y]: éxito/info/aviso → role="status" · error → role="alert" · no roba el foco
export const Playground: Story = {};
